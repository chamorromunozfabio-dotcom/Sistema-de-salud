import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto, LoginDto } from './dto';
import { UserEntity } from './entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponse } from './interfaces/auth-response.interface';
import { User, UserRole } from '@prisma/client';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';
import { AuditService } from '../common/audit/audit.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly tokenService: TokenService,
    private readonly twoFactorService: TwoFactorService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto, meta?: { ip?: string; userAgent?: string }): Promise<AuthResponse> {
    const { email, password, firstName, lastName, phone, dni } = registerDto;

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException('El email ya está registrado');

    if (dni) {
      const existingDni = await this.prisma.user.findUnique({ where: { dni } });
      if (existingDni) throw new ConflictException('El DNI ya está registrado');
    }

    const hashedPassword = await this.hashPassword(password);

    const user = await this.prisma.user.create({
      data: { email, password: hashedPassword, firstName, lastName, phone, dni },
    });

    // Crear rol si no existe (tabla de roles)
    await this.prisma.role.upsert({
      where: { name: UserRole.PATIENT },
      update: {},
      create: { name: UserRole.PATIENT, description: 'Paciente' },
    });

    this.mailService.sendWelcomeEmail(email, firstName, lastName).catch((e) => console.error('Error sending welcome email:', e));

    const accessToken = this.tokenService.generateAccessToken(user.id, user.role);
    const refreshToken = await this.tokenService.generateRefreshToken(user.id, user.role, meta?.userAgent || 'unknown', meta?.ip);

    await this.auditService.log({
      userId: user.id,
      action: 'REGISTER',
      entity: 'User',
      entityId: user.id,
      details: { email },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    const userEntity = this.mapToUserEntity(user);
    return { user: userEntity, accessToken, refreshToken } as any;
  }

  // Login con soporte 2FA y manejo de hash + tiempo de trabajo + cookies
  async login(
    loginDto: LoginDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<AuthResponse & { require2FA?: boolean; tempToken?: string }> {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      await this.auditService.log({ action: 'LOGIN_FAILED', entity: 'User', details: { email, reason: 'no_user' }, ip: meta?.ip, userAgent: meta?.userAgent });
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!user.isActive) throw new UnauthorizedException('Usuario inactivo');

    // Bloqueo por intentos fallidos (tiempo de trabajo)
    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new UnauthorizedException(`Cuenta bloqueada temporalmente hasta ${user.lockUntil.toISOString()}. Intente más tarde.`);
    }

    const isPasswordValid = await this.comparePasswords(password, user.password);
    if (!isPasswordValid) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null; // 15 min bloqueo tras 5 intentos
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts, lockUntil },
      });
      await this.auditService.log({ userId: user.id, action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, details: { attempts }, ip: meta?.ip });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Reset intentos
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockUntil: null, lastLoginAt: new Date() },
    });

    // Si 2FA habilitado, generar OTP y no dar tokens aún
    if (user.twoFactorEnabled) {
      await this.twoFactorService.generateCode(user.id, user.email, user.firstName);
      // Generar tempToken corto (5 min) para verificar 2FA
      const tempToken = this.jwtService.sign({ sub: user.id, type: '2fa_temp' }, { secret: this.configService.get('JWT_SECRET'), expiresIn: '5m' });
      await this.auditService.log({ userId: user.id, action: 'LOGIN_2FA_SENT', entity: 'User', entityId: user.id, ip: meta?.ip });
      // Retornamos require2FA para que el frontend pida código; no damos accessToken definitivo
      return {
        user: this.mapToUserEntity(user),
        accessToken: tempToken,
        require2FA: true,
        tempToken,
      } as any;
    }

    const accessToken = this.tokenService.generateAccessToken(user.id, user.role);
    const refreshToken = await this.tokenService.generateRefreshToken(user.id, user.role, meta?.userAgent || 'unknown', meta?.ip);

    await this.auditService.log({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ip: meta?.ip, userAgent: meta?.userAgent });

    const userEntity = this.mapToUserEntity(user);
    return { user: userEntity, accessToken, refreshToken } as any;
  }

  async verifyTwoFactor(email: string, code: string, meta?: { ip?: string; userAgent?: string }): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    await this.twoFactorService.verifyCode(user.id, code);

    const accessToken = this.tokenService.generateAccessToken(user.id, user.role);
    const refreshToken = await this.tokenService.generateRefreshToken(user.id, user.role, meta?.userAgent || 'unknown', meta?.ip);

    await this.auditService.log({ userId: user.id, action: '2FA_VERIFIED', entity: 'User', entityId: user.id, ip: meta?.ip });

    return { user: this.mapToUserEntity(user), accessToken, refreshToken } as any;
  }

  async enableTwoFactor(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');
    await this.twoFactorService.generateCode(user.id, user.email, user.firstName);
    return { enabled: false }; // pendiente verificar
  }

  async confirmEnableTwoFactor(userId: string, code: string): Promise<{ enabled: boolean }> {
    await this.twoFactorService.verifyCode(userId, code);
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    await this.auditService.log({ userId, action: '2FA_ENABLED', entity: 'User', entityId: userId });
    return { enabled: true };
  }

  async disableTwoFactor(userId: string): Promise<{ enabled: boolean }> {
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } });
    await this.auditService.log({ userId, action: '2FA_DISABLED', entity: 'User', entityId: userId });
    return { enabled: false };
  }

  async refreshToken(refreshToken: string, meta?: { ip?: string; userAgent?: string }): Promise<{ accessToken: string }> {
    if (!refreshToken) throw new UnauthorizedException('No hay refresh token');
    const tokenData = await this.tokenService.getRefreshTokenData(refreshToken);
    if (!tokenData) throw new UnauthorizedException('Refresh token inválido o expirado');
    // Opcional: verificar en DB que no esté revocado (hash)
    // Generar nuevo access token
    const newAccessToken = this.tokenService.generateAccessToken(tokenData.userId, tokenData.role);
    await this.auditService.log({ userId: tokenData.userId, action: 'REFRESH_TOKEN', entity: 'User', entityId: tokenData.userId, ip: meta?.ip });
    return { accessToken: newAccessToken };
  }

  async logout(refreshToken: string, userId?: string): Promise<{ message: string }> {
    if (refreshToken) await this.tokenService.revokeRefreshToken(refreshToken);
    if (userId) await this.auditService.log({ userId, action: 'LOGOUT', entity: 'User', entityId: userId });
    return { message: 'Sesión cerrada exitosamente' };
  }

  async changeUserRole(adminId: string, userId: string, newRole: UserRole, meta?: { ip?: string }): Promise<{ message: string; user: UserEntity }> {
    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.DOCTOR, UserRole.PATIENT] as any;
    if (!allowedRoles.includes(newRole)) throw new BadRequestException('Rol no válido');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    const updated = await this.prisma.user.update({ where: { id: userId }, data: { role: newRole } });
    // Invalidar TODOS los tokens del usuario (seguridad) - como en ejemplo gestor de roles
    await this.tokenService.revokeAllUserTokens(userId);

    await this.auditService.log({
      userId: adminId,
      action: 'CHANGE_ROLE',
      entity: 'User',
      entityId: userId,
      details: { from: user.role, to: newRole },
      ip: meta?.ip,
    });

    return { message: `Rol actualizado a ${newRole} para ${user.firstName}`, user: this.mapToUserEntity(updated) };
  }

  async validateUser(userId: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('Usuario no encontrado o inactivo');
    return this.mapToUserEntity(user);
  }

  async getProfile(userId: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');
    return this.mapToUserEntity(user);
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10; // tiempo de trabajo hash (work factor)
    return bcrypt.hash(password, saltRounds);
  }

  private async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  private generateToken(user: User): string {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }

  private mapToUserEntity(user: User): UserEntity {
    return new UserEntity({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      dni: user.dni,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } as any);
  }
}

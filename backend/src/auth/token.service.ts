import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

/**
 * Creacion de tokens - equivalente a 'creacion de tokem.js' del ejemplo
 * - generateAccessToken(userId, role) => JWT
 * - generateRefreshToken(userId, role, deviceInfo) => uuid + Redis setEx 7d
 * - verifyAccessToken, getRefreshTokenData, revokeRefreshToken, revokeAllUserTokens
 * + mejoras: hash con bcrypt, tiempo de trabajo (expiración), persistencia en DB RefreshToken
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresSec: number;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    this.accessExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    // REFRESH_TOKEN_EXPIRES_IN viene como "7d" -> convertir a segundos
    const raw = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN', '7d');
    this.refreshExpiresSec = this.parseExpiresToSeconds(raw);
  }

  private parseExpiresToSeconds(exp: string): number {
    const m = exp.match(/^(\d+)([smhd])$/);
    if (!m) return 7 * 24 * 60 * 60;
    const val = parseInt(m[1], 10);
    const unit = m[2];
    const mult = { s: 1, m: 60, h: 3600, d: 86400 }[unit] || 1;
    return val * mult;
  }

  // Generar Access Token (JWT) - tiempo de trabajo corto (15m por defecto)
  generateAccessToken(userId: string, role: string): string {
    return this.jwtService.sign(
      { sub: userId, role },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.accessExpiresIn as any,
      },
    );
  }

  // Generar Refresh Token - almacenado en Redis + DB con hash
  async generateRefreshToken(
    userId: string,
    role: string,
    deviceInfo = 'unknown',
    ip?: string,
  ): Promise<string> {
    const refreshToken = crypto.randomUUID(); // uuidv4 equivalente, sin dependencia extra
    const key = `refresh:${refreshToken}`;
    const payload = JSON.stringify({
      userId,
      role,
      deviceInfo,
      ip,
      createdAt: new Date().toISOString(),
    });

    // Guardar en Redis con TTL
    await this.redis.setEx(key, this.refreshExpiresSec, payload);

    // Guardar hash en DB para trazabilidad y revocación (manejo hash)
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + this.refreshExpiresSec * 1000);

    try {
      await this.prisma.refreshToken.create({
        data: {
          tokenHash,
          userId,
          deviceInfo,
          ip,
          expiresAt,
        },
      });
    } catch (e) {
      this.logger.warn(`No se pudo persistir RefreshToken en DB: ${e.message}`);
    }

    return refreshToken;
  }

  // Verificar Access Token
  verifyAccessToken(token: string): any | null {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      return null;
    }
  }

  // Obtener datos del Refresh Token desde Redis
  async getRefreshTokenData(
    refreshToken: string,
  ): Promise<{ userId: string; role: string; deviceInfo: string; createdAt: string } | null> {
    const key = `refresh:${refreshToken}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Invalidar Refresh Token (logout)
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const key = `refresh:${refreshToken}`;
    await this.redis.del(key);

    // Marcar como revocado en DB si existe (buscar por verificación de hash es costoso, hacemos soft)
    // Alternativa: guardar tokenHash y comparar; aquí invalidamos por tiempo: buscamos tokens del usuario no expirados y comparamos hash
    // Simplificado: no bloqueante
    try {
      const allTokens = await this.prisma.refreshToken.findMany({
        where: { revoked: false, expiresAt: { gt: new Date() } },
      });
      for (const t of allTokens) {
        const match = await bcrypt.compare(refreshToken, t.tokenHash).catch(() => false);
        if (match) {
          await this.prisma.refreshToken.update({ where: { id: t.id }, data: { revoked: true } });
          break;
        }
      }
    } catch {}
  }

  // Invalidar TODOS los tokens de un usuario (cambio de rol/seguridad)
  async revokeAllUserTokens(userId: string): Promise<void> {
    // Redis: buscar keys pattern refresh:*
    const keys = await this.redis.keys(`refresh:*`);
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.userId === userId) {
            await this.redis.del(key);
          }
        } catch {}
      }
    }
    // DB
    try {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      });
    } catch {}
  }

  // Hash helper (tiempo de trabajo - work factor bcrypt)
  async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  async compareHash(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
  }
}

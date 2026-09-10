import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  Res,
  Req,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { GetUser } from './decorators/get-user.decorator';
import { UserEntity } from './entities/user.entity';
import { AuthResponse } from './interfaces/auth-response.interface';
import { UserRole } from '@prisma/client';
import { Response } from 'express';

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    }),
  );
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días - tiempo de trabajo token
    path: '/',
  });
  // Opcional: también setear accessToken en cookie corta (15m) para manejo cookies completo
  // pero por seguridad preferimos solo refresh en cookie y access en memoria/header
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente', type: UserEntity })
  @ApiResponse({ status: 409, description: 'Email o DNI ya registrado' })
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result: any = await this.authService.register(registerDto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if (result.refreshToken) {
      setRefreshCookie(res, result.refreshToken);
      // No exponer refreshToken en body si se usa cookie httpOnly? lo dejamos por compatibilidad pero también cookie
    }
    return result;
  }

  @Post('login')
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión - manejo de tokens con cookies y hash' })
  @ApiResponse({ status: 200, description: 'Login exitoso', type: UserEntity })
  @ApiResponse({ status: 202, description: 'Requiere 2FA' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() loginDto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response): Promise<any> {
    const result: any = await this.authService.login(loginDto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (result.require2FA) {
      // No seteamos cookies aún; cliente debe llamar a /auth/verify-2fa
      return {
        require2FA: true,
        message: 'Se ha enviado un código de verificación a tu email. Revisa tu bandeja.',
        tempToken: result.tempToken,
        user: result.user,
      };
    }

    if (result.refreshToken) {
      setRefreshCookie(res, result.refreshToken);
    }
    // Devolver accessToken y user (refresh queda en cookie httpOnly + body para compat)
    return result;
  }

  @Post('verify-2fa')
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar código 2FA y obtener tokens' })
  async verifyTwoFactor(@Body() dto: VerifyTwoFactorDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const result: any = await this.authService.verifyTwoFactor(dto.email, dto.code, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if (result.refreshToken) setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('enable-2fa')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Habilitar 2FA - envía código OTP' })
  async enable2FA(@GetUser() user: UserEntity) {
    return this.authService.enableTwoFactor(user.id);
  }

  @Post('confirm-2fa')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar habilitación 2FA con código' })
  async confirm2FA(@GetUser() user: UserEntity, @Body() body: { code: string }) {
    return this.authService.confirmEnableTwoFactor(user.id, body.code);
  }

  @Post('disable-2fa')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deshabilitar 2FA' })
  async disable2FA(@GetUser() user: UserEntity) {
    return this.authService.disableTwoFactor(user.id);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refrescar access token usando refreshToken en cookie httpOnly' })
  async refreshToken(@Req() req: any, @Body() body?: { refreshToken?: string }, @Res({ passthrough: true }) res?: Response) {
    // Prioridad: cookie httpOnly, luego body, luego header
    let token: string | undefined = body?.refreshToken;
    if (!token) {
      // Intentar req.cookies (si cookie-parser instalado) o parse manual
      const cookies = req.cookies ?? parseCookies(req.headers.cookie);
      token = cookies?.refreshToken;
    }
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      // No usar access token como refresh
    }
    const result = await this.authService.refreshToken(token!, { ip: req.ip, userAgent: req.headers['user-agent'] });
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión - revoca refresh token y limpia cookie' })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response, @GetUser() user?: UserEntity) {
    let token: string | undefined;
    const cookies = req.cookies ?? parseCookies(req.headers.cookie);
    token = cookies?.refreshToken || req.body?.refreshToken;
    // Si está autenticado, usar user del guard; si no, intentar decode
    let userId = user?.id;
    if (!userId && req.user?.id) userId = req.user.id;
    res.clearCookie('refreshToken', { path: '/' });
    return this.authService.logout(token || '', userId);
  }

  @Post('admin/change-role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar rol de usuario (solo ADMIN) - gestor de roles' })
  async changeRole(@Body() dto: ChangeRoleDto, @GetUser() admin: UserEntity, @Req() req: any) {
    return this.authService.changeUserRole(admin.id, dto.userId, dto.newRole, { ip: req.ip });
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario', type: UserEntity })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getProfile(@GetUser() user: UserEntity): Promise<UserEntity> {
    return this.authService.getProfile(user.id);
  }

  @Get('debug/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Debug: Verificar datos del usuario en el token' })
  async debugMe(@Request() req) {
    return {
      message: 'Datos del usuario desde el token JWT',
      user: req.user,
      hasRole: !!req.user.role,
      roleValue: req.user.role,
    };
  }
}

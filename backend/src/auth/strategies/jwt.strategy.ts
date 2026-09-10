import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UserEntity } from '../entities/user.entity';
import { Request } from 'express';

// Extractor que soporta Authorization Bearer y cookies (accessToken en cookie httpOnly)
function cookieExtractor(req: Request): string | null {
  if (!req || !req.headers) return null;
  // Si cookie-parser está disponible, req.cookies existe
  const cookies: any = (req as any).cookies;
  if (cookies && cookies.accessToken) return cookies.accessToken;
  if (cookies && cookies.refreshToken) {
    // No usar refreshToken como accessToken
  }
  // Fallback parsing manual
  const header = req.headers.cookie;
  if (!header) return null;
  const match = header.match(/(?:^|;\s*)accessToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      secretOrKey: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
      ignoreExpiration: false,
    });
  }

  async validate(payload: any): Promise<UserEntity> {
    // Rechazar temp tokens de 2FA
    if ((payload as any).type === '2fa_temp') {
      throw new UnauthorizedException('Token temporal 2FA no válido para autenticación');
    }
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}

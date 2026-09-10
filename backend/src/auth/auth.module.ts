import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { RedisModule } from '../common/redis/redis.module';
import { AuditModule } from '../common/audit/audit.module';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    RedisModule,
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'super-secret-key-change-in-production',
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') || '15m') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, TwoFactorService, JwtStrategy],
  exports: [JwtStrategy, PassportModule, JwtModule, TokenService, TwoFactorService],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { DoctorsModule } from './doctors/doctors.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TriageModule } from './triage/triage.module';

@Module({
  imports: [
    // Config Module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting global - anti brute-force / DDoS ligero
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minuto
        limit: 60, // 60 req/min por IP (general)
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 10, // 10 intentos login/register por minuto
      },
    ]),

    // Bull Queue (Redis)
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),

    // Application Modules
    PrismaModule,
    AuthModule,
    SpecialtiesModule,
    DoctorsModule,
    AppointmentsModule,
    NotificationsModule,
    TriageModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

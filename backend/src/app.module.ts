import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuditModule } from './common/audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { DoctorsModule } from './doctors/doctors.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TriageModule } from './triage/triage.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { AuditLogModule } from './audit/audit.module';

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

    // Bull Queue (Redis) - configuracion de redis.js adaptada
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),

    // Application Modules
    PrismaModule,
    RedisModule, // configuracion de redis - autenticacion en el servidor
    AuditModule, // tabla de logs
    AuthModule, // login con token + autenticador + gestor de roles + creacion controlador auth + creacion tokens
    UsersModule, // CRUD pacientes, doctores (solo admin registra), admin maneja todo
    SpecialtiesModule,
    DoctorsModule,
    AppointmentsModule,
    NotificationsModule,
    TriageModule,
    MedicalRecordsModule, // historia clinica + IA Gemini protocolo/diagnostico
    AuditLogModule, // endpoint logs
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as hpp from 'hpp';
import { AppModule } from './app.module';
import { SanitizePipe } from './common/pipes/sanitize.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Middleware cookie parser liviano (sin dependencia cookie-parser) + autenticación en el servidor (ejemplo) ──
  // Equivalente a: app.use(cookieParser()) del ejemplo 'autenticacion en el servidor.js'
  // Soporta refreshToken httpOnly cookie y manejo de tokens con hash + tiempo de trabajo
  app.use((req: any, _res, next) => {
    const header = req.headers?.cookie;
    if (header) {
      req.cookies = Object.fromEntries(
        header.split(';').map((c: string) => {
          const [k, ...v] = c.trim().split('=');
          try {
            return [k, decodeURIComponent(v.join('='))];
          } catch {
            return [k, v.join('=')];
          }
        }),
      );
    } else {
      req.cookies = {};
    }
    next();
  });

  // Intentar usar cookie-parser si está instalado (mejor compatibilidad)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());
  } catch {}

  // ── Seguridad HTTP headers (helmet) ──
  app.use(
    helmet({
      contentSecurityPolicy: false, // Swagger UI necesita inline scripts
      crossOriginEmbedderPolicy: false,
    }),
  );
  // Previene HTTP Parameter Pollution
  app.use(hpp());

  // Enable CORS estricto - solo frontends permitidos, con credentials para cookies
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];
  app.enableCors({
    origin: (origin, cb) => {
      // Permitir requests sin origin (Postman, curl, mobile) y origins whitelisteados
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true, // necesario para enviar/recibir cookies httpOnly (refreshToken)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Sanitización global contra XSS / JS injection (antes de validación)
  app.useGlobalPipes(new SanitizePipe());
  // Validación estricta DTOs - previene injection via campos extra
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('SaludPública Connect API')
    .setDescription('Sistema de Gestión de Turnos para Centros de Salud Públicos - Autenticación JWT con refresh en cookies httpOnly, 2FA, Roles RBAC, Historia Clínica e IA Gemini')
    .setVersion('1.0')
    .addTag('auth', 'Autenticación JWT, refresh en cookies httpOnly, 2FA, cambio de roles')
    .addTag('users', 'Gestión de Usuarios / Pacientes / Doctores (solo ADMIN crea doctores)')
    .addTag('specialties', 'Gestión de Especialidades')
    .addTag('doctors', 'Gestión de Médicos')
    .addTag('appointments', 'Gestión de Turnos')
    .addTag('appointments-public', 'Turnos Públicos (token por email)')
    .addTag('medical-records', 'Historia Clínica - paciente ve, doctor genera, admin administra + IA Gemini protocolo/diagnóstico')
    .addTag('triage', 'Triaje Inteligente con IA (Gemini)')
    .addTag('notifications', 'Sistema de Notificaciones')
    .addTag('audit', 'Logs de auditoría')
    .addBearerAuth()
    .addCookieAuth('refreshToken')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Validación de secretos en producción
  if (process.env.NODE_ENV === 'production') {
    const secret = process.env.JWT_SECRET || '';
    if (secret.length < 32 || secret.includes('super-secret') || secret.includes('cambiar')) {
      console.error('❌ JWT_SECRET inseguro en producción. Configure uno de >=32 chars aleatorios.');
      process.exit(1);
    }
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('postgres:postgres@localhost')) {
      console.warn('⚠️ DATABASE_URL parece ser de desarrollo.');
    }
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Backend running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api`);
  console.log(`🔒 Seguridad: helmet, hpp, throttler, SanitizePipe XSS, CORS con credentials (cookies), JWT access 15m + refresh 7d httpOnly, hash bcrypt 10, 2FA OTP`);
  console.log(`🍪 Cookies: refreshToken httpOnly secure sameSite=strict maxAge 7d - manejo de tokens con hash y tiempo de trabajo`);
  console.log(`📦 Redis: ioredis client con fallback memoria - configuración de redis.js + Bull queue`);
}

bootstrap();

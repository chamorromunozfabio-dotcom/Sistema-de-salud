import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import hpp from 'hpp';
import { AppModule } from './app.module';
import { SanitizePipe } from './common/pipes/sanitize.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Seguridad HTTP headers (helmet) ──
  app.use(
    helmet({
      contentSecurityPolicy: false, // Swagger UI necesita inline scripts
      crossOriginEmbedderPolicy: false,
    }),
  );
  // Previene HTTP Parameter Pollution
  app.use(hpp());

  // Enable CORS estricto - solo frontends permitidos
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
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
    .setDescription('Sistema de Gestión de Turnos para Centros de Salud Públicos')
    .setVersion('1.0')
    .addTag('auth', 'Autenticación JWT y RBAC')
    .addTag('specialties', 'Gestión de Especialidades')
    .addTag('doctors', 'Gestión de Médicos')
    .addTag('appointments', 'Gestión de Turnos')
    .addTag('appointments-public', 'Turnos Públicos (token por email)')
    .addTag('triage', 'Triaje Inteligente con IA (Gemini)')
    .addTag('notifications', 'Sistema de Notificaciones')
    .addBearerAuth()
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
  console.log(`🔒 Seguridad: helmet, hpp, throttler (60/min global, 5-10/min auth), SanitizePipe XSS, CORS estricto`);
}

bootstrap();

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

import './instrument';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { assertProductionSecrets } from './security/env';
import { securityHeadersMiddleware } from './security/security-headers.middleware';
import { createRateLimitMiddleware } from './security/rate-limit.middleware';
import { mongoSanitizeMiddleware } from './security/mongo-sanitize.middleware';
import { SanitizedExceptionFilter } from './security/sanitized-exception.filter';

function getAllowedOrigins(): string[] {
  const configured = process.env.FRONTEND_URL || 'http://localhost:3000';
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin) => origin !== '*');
}

async function bootstrap() {
  assertProductionSecrets();

  const app = await NestFactory.create(AppModule);

  // İlk admin kullanıcısını oluştur
  await createInitialAdmin(app);

  // Global prefix
  app.setGlobalPrefix('api');

  app.use(securityHeadersMiddleware);
  app.use(mongoSanitizeMiddleware);
  app.use(
    '/api/auth/login',
    createRateLimitMiddleware({
      keyPrefix: 'login',
      windowMs: 15 * 60 * 1000,
      max: 10,
    }),
  );
  app.use(
    '/api',
    createRateLimitMiddleware({
      keyPrefix: 'api',
      windowMs: 60 * 1000,
      max: Number(process.env.API_RATE_LIMIT_PER_MINUTE || 300),
    }),
  );

  // CORS
  app.enableCors({
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: () => new BadRequestException('Invalid request payload'),
    })
  );
  app.useGlobalFilters(new SanitizedExceptionFilter());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('DHY Order App API')
    .setDescription('B2B Wholesale Ordering App API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`API server running on http://localhost:${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

async function createInitialAdmin(app: any) {
  try {
    const authService = app.get(AuthService);
    const adminUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin_cabir';
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@test.com';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

    if (!adminPassword) {
      console.warn('INITIAL_ADMIN_PASSWORD is not set; skipping initial admin creation');
      return;
    }

    // Admin kullanıcısını oluştur (varsa oluşturmaz)
    await authService.createAdminIfNotExists(adminUsername, adminEmail, adminPassword);
    console.log('İlk admin kullanıcısı hazır:');
    console.log(`   Kullanıcı Adı: ${adminUsername}`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Rol: admin`);
  } catch (error: any) {
    console.warn('⚠️  Admin kullanıcısı oluşturulurken hata:', error.message);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start API:', error);
  process.exit(1);
});

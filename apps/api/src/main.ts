import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // İlk admin kullanıcısını oluştur
  await createInitialAdmin(app);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

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
    const adminUsername = 'admin';
    const adminEmail = 'admin@test.com';
    const adminPassword = 'admin123';

    // Admin kullanıcısını oluştur (varsa oluşturmaz)
    await authService.createAdminIfNotExists(adminUsername, adminEmail, adminPassword);
    console.log('✅ İlk admin kullanıcısı hazır:');
    console.log(`   Kullanıcı Adı: ${adminUsername}`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Şifre: ${adminPassword}`);
    console.log(`   Rol: admin`);
  } catch (error: any) {
    console.warn('⚠️  Admin kullanıcısı oluşturulurken hata:', error.message);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start API:', error);
  process.exit(1);
});

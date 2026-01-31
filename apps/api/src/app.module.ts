import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { ConnectionSettingsModule } from './connection-settings/connection-settings.module';
import { SnelStartModule } from './snelstart/snelstart.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { CustomersModule } from './customers/customers.module';
import { ImagesModule } from './images/images.module';
import { PricingModule } from './pricing/pricing.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { CacheModule } from './cache/cache.module';
import { CompanyInfoModule } from './company-info/company-info.module';
import { R2Module } from './r2/r2.module';

@Module({
  imports: [
    // 🌍 Global config
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 🍃 MongoDB
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
        retryWrites: true,
        w: 'majority',
      }),
    }),

    // 🧵 Redis / BullMQ
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),

    AuthModule,
    ConnectionSettingsModule,
    SnelStartModule,
    CacheModule,
    ProductsModule,
    CategoriesModule,
    CustomersModule,
    ImagesModule,
    PricingModule,
    CartModule,
    OrdersModule,
    AuditModule,
    HealthModule,
    CompanyInfoModule,
    R2Module,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
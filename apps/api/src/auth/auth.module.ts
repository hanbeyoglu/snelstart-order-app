import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { PriceOverridePolicyService } from './price-override-policy.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User, UserSchema } from './schemas/user.schema';
import { ConnectionSettingsModule } from '../connection-settings/connection-settings.module';
import { SnelStartModule } from '../snelstart/snelstart.module';
import { CategoriesModule } from '../categories/categories.module';
import { ProductsModule } from '../products/products.module';
import { CacheModule } from '../cache/cache.module';
import { getJwtSecret } from '../security/env';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PassportModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
    forwardRef(() => ConnectionSettingsModule),
    forwardRef(() => SnelStartModule),
    CategoriesModule,
    ProductsModule,
    CacheModule,
  ],
  providers: [AuthService, JwtStrategy, PriceOverridePolicyService],
  controllers: [AuthController],
  exports: [AuthService, PriceOverridePolicyService],
})
export class AuthModule {}

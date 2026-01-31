import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SnelStartModule } from '../snelstart/snelstart.module';
import { PricingModule } from '../pricing/pricing.module';
import { CacheModule } from '../cache/cache.module';
import { CategoriesModule } from '../categories/categories.module';
import { ImagesModule } from '../images/images.module';
import { Product, ProductSchema } from './schemas/product.schema';

@Module({
  imports: [
    SnelStartModule,
    PricingModule,
    CacheModule,
    forwardRef(() => CategoriesModule),
    forwardRef(() => ImagesModule),
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}


import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { SnelStartModule } from '../snelstart/snelstart.module';
import { CacheModule } from '../cache/cache.module';
import { ProductsModule } from '../products/products.module';
import { Category, CategorySchema } from './schemas/category.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';

@Module({
  imports: [
    SnelStartModule,
    CacheModule,
    forwardRef(() => ProductsModule),
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}


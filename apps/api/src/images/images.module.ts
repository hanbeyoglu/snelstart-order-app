import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import {
  ProductImageMapping,
  ProductImageMappingSchema,
} from './schemas/product-image-mapping.schema';
import {
  CategoryImageMapping,
  CategoryImageMappingSchema,
} from './schemas/category-image-mapping.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Category, CategorySchema } from '../categories/schemas/category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductImageMapping.name, schema: ProductImageMappingSchema },
      { name: CategoryImageMapping.name, schema: CategoryImageMappingSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}


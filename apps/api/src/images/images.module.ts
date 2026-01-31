import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import {
  ProductImageMapping,
  ProductImageMappingSchema,
} from './schemas/product-image-mapping.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductImageMapping.name, schema: ProductImageMappingSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}


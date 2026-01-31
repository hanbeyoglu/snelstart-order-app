import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export interface ProductImage {
  id: string;
  snelstartProductId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  isCover: boolean;
  uploadedAt: Date;
}

@Schema({ timestamps: true })
export class ProductImageMapping extends Document {
  @Prop({ required: true, unique: true })
  snelstartProductId: string;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  images: ProductImage[];

  @Prop()
  coverImageId?: string;
}

export const ProductImageMappingSchema = SchemaFactory.createForClass(ProductImageMapping);
export type ProductImageMappingDocument = ProductImageMapping & Document;


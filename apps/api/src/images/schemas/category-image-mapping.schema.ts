import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export interface CategoryImage {
  id: string;
  snelstartCategoryId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  isCover: boolean;
  uploadedAt: Date;
}

@Schema({ timestamps: true })
export class CategoryImageMapping extends Document {
  @Prop({ required: true, unique: true })
  snelstartCategoryId: string;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  images: CategoryImage[];

  @Prop()
  coverImageId?: string;
}

export const CategoryImageMappingSchema = SchemaFactory.createForClass(CategoryImageMapping);
export type CategoryImageMappingDocument = CategoryImageMapping & Document;

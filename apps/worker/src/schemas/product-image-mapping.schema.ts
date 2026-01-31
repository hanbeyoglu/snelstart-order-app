import { Schema, Document, Model } from 'mongoose';

export interface ProductImage {
  id: string;
  snelstartProductId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  isCover: boolean;
  uploadedAt: Date;
}

export interface ProductImageMapping extends Document {
  snelstartProductId: string;
  images: ProductImage[];
  coverImageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ProductImageMappingSchema = new Schema<ProductImageMapping>(
  {
    snelstartProductId: { type: String, required: true, unique: true },
    images: { type: [Schema.Types.Mixed], default: [] } as any,
    coverImageId: String,
  },
  { timestamps: true },
);

export type ProductImageMappingModel = Model<ProductImageMapping>;


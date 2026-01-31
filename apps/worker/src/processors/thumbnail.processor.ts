import { Job } from 'bullmq';
import axios from 'axios';
import sharp from 'sharp';
import { Client as MinIOClient } from 'minio';
import mongoose from 'mongoose';
import { ProductImageMapping, ProductImageMappingSchema } from '../schemas/product-image-mapping.schema';

export class ThumbnailProcessor {
  private minioClient: MinIOClient;

  constructor() {
    this.minioClient = new MinIOClient({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });
  }

  async process(job: Job) {
    const { productId, imageId, imageUrl } = job.data;

    try {
      // Download original image
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data);

      // Generate thumbnail (300x300)
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Upload thumbnail to MinIO
      const bucketName = process.env.MINIO_BUCKET || 'product-images';
      const thumbnailFileName = `${productId}/thumbnails/${imageId}.jpg`;

      await this.minioClient.putObject(
        bucketName,
        thumbnailFileName,
        thumbnailBuffer,
        thumbnailBuffer.length,
        { 'Content-Type': 'image/jpeg' },
      );

      const thumbnailUrl = `${process.env.MINIO_PUBLIC_URL || `http://localhost:9000`}/${bucketName}/${thumbnailFileName}`;

      // Update image mapping
      const ImageMappingModel =
        mongoose.models.ProductImageMapping ||
        mongoose.model('ProductImageMapping', ProductImageMappingSchema);

      const mapping = await ImageMappingModel.findOne({ snelstartProductId: productId }).exec();
      if (mapping) {
        const image = mapping.images.find((img: any) => img.id === imageId);
        if (image) {
          image.thumbnailUrl = thumbnailUrl;
          await mapping.save();
        }
      }

      return { message: 'Thumbnail generated', thumbnailUrl };
    } catch (error: any) {
      console.error(`Thumbnail generation failed for ${imageId}:`, error.message);
      throw error;
    }
  }
}


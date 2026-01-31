import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProductImageMapping,
  ProductImageMappingDocument,
  ProductImage,
} from './schemas/product-image-mapping.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';

@Injectable()
export class ImagesService {
  constructor(
    @InjectModel(ProductImageMapping.name)
    private imageMappingModel: Model<ProductImageMappingDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
  ) {}

  /**
   * Resolve product ID - if artikelcode/artikelnummer is provided, find the actual UUID
   */
  private async resolveProductId(identifier: string): Promise<string> {
    console.log(`[ImagesService] Resolving product ID for: ${identifier}`);
    
    // Check if it's already a UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(identifier)) {
      // It's already a UUID, verify it exists in database
      console.log(`[ImagesService] Identifier is UUID format, checking database...`);
      const product = await this.productModel.findOne({ snelstartId: identifier }).exec();
      if (!product) {
        console.error(`[ImagesService] Product not found with snelstartId: ${identifier}`);
        throw new NotFoundException(`Ürün bulunamadı: ${identifier}`);
      }
      console.log(`[ImagesService] Found product: ${product.omschrijving} (${product.snelstartId})`);
      return identifier;
    }

    // It's likely an artikelcode or artikelnummer, search in database
    console.log(`[ImagesService] Identifier is not UUID, searching by artikelnummer...`);
    const product = await this.productModel.findOne({
      $or: [
        { artikelnummer: identifier },
        { snelstartId: identifier }, // Also check if it's stored as snelstartId
      ],
    }).exec();

    if (!product) {
      console.error(`[ImagesService] Product not found with artikelnummer or snelstartId: ${identifier}`);
      throw new NotFoundException(
        `Ürün bulunamadı. Lütfen geçerli bir ürün ID'si (UUID) veya ürün kodu girin: ${identifier}`
      );
    }

    console.log(`[ImagesService] Found product: ${product.omschrijving} (${product.snelstartId})`);
    if (!product.snelstartId) {
      throw new NotFoundException(`Ürün bulundu ancak snelstartId eksik: ${identifier}`);
    }

    return product.snelstartId;
  }

  /**
   * Add image by URL (R2 CDN URL or external URL)
   */
  async addImageByUrl(
    productId: string,
    imageUrl: string,
    isCover: boolean = false,
  ): Promise<ProductImage> {
    try {
      if (!imageUrl || !imageUrl.trim()) {
        throw new BadRequestException('Resim URL\'si gerekli');
      }

      if (!productId) {
        throw new BadRequestException("Ürün ID'si gerekli");
      }

      // Validate URL format
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        throw new BadRequestException('Geçerli bir HTTP/HTTPS URL gerekli');
      }

      console.log(`[ImagesService] Adding image by URL for productId: ${productId}`);

      // Resolve product ID (handle artikelcode/artikelnummer)
      const resolvedProductId = await this.resolveProductId(productId);
      console.log(`[ImagesService] Resolved product ID: ${resolvedProductId}`);

      const image: ProductImage = {
        id: `img-${Date.now()}`,
        snelstartProductId: resolvedProductId,
        imageUrl: imageUrl.trim(), // Store the full URL directly
        isCover,
        uploadedAt: new Date(),
      };

      console.log(`[ImagesService] Creating/updating mapping for product: ${resolvedProductId}`);

      // Update or create mapping
      let mapping = await this.imageMappingModel.findOne({ snelstartProductId: resolvedProductId }).exec();
      if (!mapping) {
        console.log(`[ImagesService] Creating new mapping`);
        mapping = new this.imageMappingModel({ snelstartProductId: resolvedProductId, images: [] });
      } else {
        console.log(`[ImagesService] Updating existing mapping with ${mapping.images.length} images`);
      }

      // If this is cover, unset others
      if (isCover) {
        mapping.images.forEach((img) => (img.isCover = false));
        mapping.coverImageId = image.id;
      }

      mapping.images.push(image);
      
      try {
        await mapping.save();
        console.log(`[ImagesService] Mapping saved successfully. Total images: ${mapping.images.length}`);
      } catch (error: any) {
        console.error(`[ImagesService] Database save error:`, error.message);
        throw new BadRequestException(`Veritabanı kayıt hatası: ${error.message}`);
      }

      // Return image with URL
      return image;
    } catch (error: any) {
      console.error(`[ImagesService] Add image by URL error:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Resim ekleme hatası: ${error.message}`);
    }
  }

  async getImages(productId: string): Promise<ProductImage[]> {
    console.log(`[ImagesService] Getting images for productId: ${productId}`);
    const resolvedProductId = await this.resolveProductId(productId);
    console.log(`[ImagesService] Resolved product ID: ${resolvedProductId}`);
    
    const mapping = await this.imageMappingModel.findOne({ snelstartProductId: resolvedProductId }).exec();
    console.log(`[ImagesService] Mapping found: ${mapping ? 'yes' : 'no'}`);
    
    if (!mapping) {
      console.log(`[ImagesService] No mapping found for product: ${resolvedProductId}`);
      return [];
    }
    
    // Check images array - it might be empty or undefined
    const images = mapping.images || [];
    console.log(`[ImagesService] Images array length: ${images.length}`);
    
    if (images.length === 0) {
      console.log(`[ImagesService] No images found for product: ${resolvedProductId}`);
      return [];
    }
    
    console.log(`[ImagesService] Found ${images.length} images`);

    // Filter out legacy MinIO format images and clean them up
    const validImages: any[] = [];
    const invalidImageIds: string[] = [];

    images.forEach((image: any) => {
      const imageUrl = image.imageUrl;
      
      // If imageUrl is a full HTTP/HTTPS URL (R2 CDN URL), keep it
      if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
        validImages.push(image);
      } else {
        // Legacy MinIO format - mark for deletion
        console.warn(`[ImagesService] Found legacy MinIO image, will be removed: ${imageUrl}`);
        invalidImageIds.push(image.id);
      }
    });

    // Remove invalid images from database if any found
    if (invalidImageIds.length > 0) {
      console.log(`[ImagesService] Removing ${invalidImageIds.length} legacy MinIO images from database`);
      mapping.images = mapping.images.filter((img: any) => !invalidImageIds.includes(img.id));
      
      // Update coverImageId if it was one of the removed images
      if (mapping.coverImageId && invalidImageIds.includes(mapping.coverImageId)) {
        mapping.coverImageId = validImages[0]?.id || null;
        if (mapping.coverImageId && validImages[0]) {
          validImages[0].isCover = true;
        }
      }
      
      await mapping.save();
      console.log(`[ImagesService] Cleaned up ${invalidImageIds.length} legacy images`);
    }

    // Return valid images with their URLs
    const imagesWithUrls = validImages.map((image: any) => {
      const result = {
        id: image.id,
        snelstartProductId: image.snelstartProductId || resolvedProductId,
        imageUrl: image.imageUrl,
        thumbnailUrl: image.thumbnailUrl || image.imageUrl,
        isCover: image.isCover || false,
        uploadedAt: image.uploadedAt || new Date(),
      };
      return result;
    });
    
    console.log(`[ImagesService] Returning ${imagesWithUrls.length} images with URLs`);
    return imagesWithUrls;
  }

  /**
   * Get cover images for multiple products (bulk operation)
   */
  async getCoverImagesForProducts(productIds: string[]): Promise<Record<string, string | null>> {
    if (!productIds || productIds.length === 0) {
      return {};
    }

    const coverImagesMap: Record<string, string | null> = {};

    // Get all mappings in one query
    const mappings = await this.imageMappingModel
      .find({ snelstartProductId: { $in: productIds } })
      .exec();

    // Process each mapping to get cover image URL
    await Promise.all(
      mappings.map(async (mapping) => {
        const productId = mapping.snelstartProductId;
        const images = mapping.images || [];
        
        if (images.length === 0) {
          coverImagesMap[productId] = null;
          return;
        }

        // Find cover image (isCover=true or first image)
        const coverImage = images.find((img: any) => img.isCover) || images[0];
        if (!coverImage) {
          coverImagesMap[productId] = null;
          return;
        }

        // Get cover image URL (should be a full HTTP/HTTPS URL)
        let coverImageUrl: string | null = null;
        
        // Prefer thumbnail if available, otherwise use main image
        if (coverImage.thumbnailUrl && (coverImage.thumbnailUrl.startsWith('http://') || coverImage.thumbnailUrl.startsWith('https://'))) {
          coverImageUrl = coverImage.thumbnailUrl;
        } else if (coverImage.imageUrl && (coverImage.imageUrl.startsWith('http://') || coverImage.imageUrl.startsWith('https://'))) {
          coverImageUrl = coverImage.imageUrl;
        }

        coverImagesMap[productId] = coverImageUrl;
      })
    );

    // Set null for products without images
    productIds.forEach((id) => {
      if (!(id in coverImagesMap)) {
        coverImagesMap[id] = null;
      }
    });

    return coverImagesMap;
  }

  async setCoverImage(productId: string, imageId: string): Promise<void> {
    const resolvedProductId = await this.resolveProductId(productId);
    const mapping = await this.imageMappingModel.findOne({ snelstartProductId: resolvedProductId }).exec();
    if (!mapping) {
      throw new NotFoundException('Product image mapping not found');
    }

    mapping.images.forEach((img) => {
      img.isCover = img.id === imageId;
    });
    mapping.coverImageId = imageId;
    await mapping.save();
  }

  async deleteImage(productId: string, imageId: string): Promise<void> {
    const resolvedProductId = await this.resolveProductId(productId);
    const mapping = await this.imageMappingModel.findOne({ snelstartProductId: resolvedProductId }).exec();
    if (!mapping) {
      throw new NotFoundException('Product image mapping not found');
    }

    const image = mapping.images.find((img) => img.id === imageId);
    if (!image) {
      throw new NotFoundException('Image not found');
    }

    // Note: R2 object deletion should be handled separately if needed
    // For now, we only remove from database
    // R2 objects can be deleted via lifecycle policies or manual cleanup

    // Remove from mapping
    mapping.images = mapping.images.filter((img) => img.id !== imageId);
    if (mapping.coverImageId === imageId) {
      mapping.coverImageId = mapping.images[0]?.id;
      if (mapping.coverImageId) {
        mapping.images[0].isCover = true;
      }
    }
    await mapping.save();
  }

  async updateThumbnailUrl(imageId: string, thumbnailUrl: string): Promise<void> {
    const mapping = await this.imageMappingModel
      .findOne({ 'images.id': imageId })
      .exec();
    if (!mapping) {
      return;
    }

    const image = mapping.images.find((img) => img.id === imageId);
    if (image) {
      image.thumbnailUrl = thumbnailUrl;
      await mapping.save();
    }
  }
}

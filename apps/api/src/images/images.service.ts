import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProductImageMapping,
  ProductImageMappingDocument,
  ProductImage,
} from './schemas/product-image-mapping.schema';
import {
  CategoryImageMapping,
  CategoryImageMappingDocument,
  CategoryImage,
} from './schemas/category-image-mapping.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class ImagesService {
  constructor(
    @InjectModel(ProductImageMapping.name)
    private imageMappingModel: Model<ProductImageMappingDocument>,
    @InjectModel(CategoryImageMapping.name)
    private categoryImageMappingModel: Model<CategoryImageMappingDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    @InjectModel(Category.name)
    private categoryModel: Model<CategoryDocument>,
    private cacheService: CacheService,
  ) {}

  /**
   * Add cache-busting parameter to image URL to prevent browser/CDN caching
   */
  private addCacheBustingParam(imageUrl: string): string {
    try {
      const url = new URL(imageUrl);
      // Add timestamp as version parameter for cache-busting
      url.searchParams.set('v', Date.now().toString());
      return url.toString();
    } catch {
      // If URL parsing fails, return original URL
      return imageUrl;
    }
  }

  /**
   * Resolve product ID - if artikelcode/artikelnummer is provided, find the actual UUID
   */
  private async resolveProductId(identifier: string): Promise<string> {
    console.log(`[ImagesService] Resolving product ID for: ${identifier} (type: ${typeof identifier})`);
    
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
    // Try both string and number comparison (MongoDB might store as number)
    console.log(`[ImagesService] Identifier is not UUID, searching by artikelcode, artikelnummer, or snelstartId...`);
    
    // Build query with multiple conditions - try both string and number
    const queryConditions: any[] = [
      { snelstartId: identifier }, // Check snelstartId first (most reliable)
      { artikelcode: identifier },
      { artikelnummer: identifier },
    ];

    // If identifier is numeric, also try as number (for artikelcode/artikelnummer)
    if (/^\d+$/.test(identifier)) {
      const numericIdentifier = identifier;
      queryConditions.push(
        { artikelcode: numericIdentifier },
        { artikelnummer: numericIdentifier },
      );
    }

    const product = await this.productModel.findOne({
      $or: queryConditions,
    }).exec();

    if (!product) {
      // Log more details for debugging
      console.error(`[ImagesService] Product not found with identifier: ${identifier}`);
      console.error(`[ImagesService] Searched in: artikelcode, artikelnummer, snelstartId`);
      
      // Try to find similar products for debugging
      const sampleProducts = await this.productModel.find().limit(5).select('artikelcode artikelnummer snelstartId omschrijving').exec();
      console.error(`[ImagesService] Sample products in DB:`, sampleProducts.map(p => ({
        snelstartId: p.snelstartId,
        artikelcode: p.artikelcode,
        artikelnummer: p.artikelnummer,
        omschrijving: p.omschrijving,
      })));
      
      throw new NotFoundException(
        `Ürün bulunamadı. Lütfen geçerli bir ürün ID'si (UUID) veya ürün kodu girin: ${identifier}`
      );
    }

    console.log(`[ImagesService] Found product: ${product.omschrijving} (snelstartId: ${product.snelstartId}, artikelcode: ${product.artikelcode}, artikelnummer: ${product.artikelnummer})`);
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

      // Add cache-busting parameter to image URL to prevent browser/CDN caching
      const imageUrlWithVersion = this.addCacheBustingParam(imageUrl.trim());

      const image: ProductImage = {
        id: `img-${Date.now()}`,
        snelstartProductId: resolvedProductId,
        imageUrl: imageUrlWithVersion, // Store the full URL with cache-busting
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
        
        // Update Product schema with cover image URL
        try {
          await this.productModel.findOneAndUpdate(
            { snelstartId: resolvedProductId },
            { imageUrl: imageUrl.trim() },
            { upsert: false }
          ).exec();
          console.log(`[ImagesService] Product schema updated with cover image URL: ${imageUrl.trim()}`);
        } catch (error: any) {
          console.error(`[ImagesService] Error updating Product schema:`, error.message);
          // Don't throw error, just log it - image mapping is more important
        }
      }

      mapping.images.push(image);
      
      try {
        await mapping.save();
        console.log(`[ImagesService] Mapping saved successfully. Total images: ${mapping.images.length}`);
      } catch (error: any) {
        console.error(`[ImagesService] Database save error:`, error.message);
        throw new BadRequestException(`Veritabanı kayıt hatası: ${error.message}`);
      }

      // Invalidate cache to ensure fresh data
      try {
        await this.cacheService.invalidateProductCache(resolvedProductId);
        await this.cacheService.deletePattern('products:*');
        console.log(`[ImagesService] Cache invalidated for product: ${resolvedProductId}`);
      } catch (error: any) {
        console.warn(`[ImagesService] Cache invalidation failed (non-critical):`, error.message);
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

    const coverImage = mapping.images.find((img) => img.id === imageId);
    if (!coverImage) {
      throw new NotFoundException('Image not found');
    }

    mapping.images.forEach((img) => {
      img.isCover = img.id === imageId;
    });
    mapping.coverImageId = imageId;
    await mapping.save();

    // Update Product schema with cover image URL
    try {
      await this.productModel.findOneAndUpdate(
        { snelstartId: resolvedProductId },
        { imageUrl: coverImage.imageUrl },
        { upsert: false }
      ).exec();
      console.log(`[ImagesService] Product schema updated with cover image URL: ${coverImage.imageUrl}`);
    } catch (error: any) {
      console.error(`[ImagesService] Error updating Product schema:`, error.message);
      // Don't throw error, just log it - image mapping is more important
    }
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

    // Update Product schema
    try {
      const coverImage = mapping.images.find((img: any) => img.isCover);
      await this.productModel.findOneAndUpdate(
        { snelstartId: resolvedProductId },
        { imageUrl: coverImage?.imageUrl || null },
        { upsert: false }
      ).exec();
    } catch (error: any) {
      console.error(`[ImagesService] Error updating Product schema:`, error.message);
    }

    // Invalidate cache to ensure fresh data
    try {
      await this.cacheService.invalidateProductCache(resolvedProductId);
      await this.cacheService.deletePattern('products:*');
      console.log(`[ImagesService] Cache invalidated for product: ${resolvedProductId}`);
    } catch (error: any) {
      console.warn(`[ImagesService] Cache invalidation failed (non-critical):`, error.message);
    }
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

  // ========== Category Image Methods ==========

  async getCategoryImages(categoryId: string): Promise<CategoryImage[]> {
    const mapping = await this.categoryImageMappingModel
      .findOne({ snelstartCategoryId: categoryId })
      .exec();

    if (!mapping || !mapping.images || mapping.images.length === 0) {
      return [];
    }

    return mapping.images.map((img: any) => ({
      id: img.id,
      snelstartCategoryId: categoryId,
      imageUrl: img.imageUrl,
      thumbnailUrl: img.thumbnailUrl,
      isCover: img.isCover || false,
      uploadedAt: img.uploadedAt || new Date(),
    }));
  }

  async addCategoryImageByUrl(
    categoryId: string,
    imageUrl: string,
    isCover: boolean = false,
  ): Promise<CategoryImage> {
    if (!imageUrl || !imageUrl.startsWith('http')) {
      throw new BadRequestException('Geçersiz image URL');
    }

    // Verify category exists
    const category = await this.categoryModel.findOne({ snelstartId: categoryId }).exec();
    if (!category) {
      throw new NotFoundException(`Kategori bulunamadı: ${categoryId}`);
    }

    let mapping = await this.categoryImageMappingModel
      .findOne({ snelstartCategoryId: categoryId })
      .exec();

    if (!mapping) {
      mapping = new this.categoryImageMappingModel({
        snelstartCategoryId: categoryId,
        images: [],
      });
    }

    // If this is cover or first image, mark as cover
    if (isCover || mapping.images.length === 0) {
      // Unmark all existing images as cover
      mapping.images.forEach((img: any) => {
        img.isCover = false;
      });
      isCover = true;
    }

    // Add cache-busting parameter to image URL to prevent browser/CDN caching
    const imageUrlWithVersion = this.addCacheBustingParam(imageUrl);

    const newImage: CategoryImage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      snelstartCategoryId: categoryId,
      imageUrl: imageUrlWithVersion, // Store the full URL with cache-busting
      isCover,
      uploadedAt: new Date(),
    };

    mapping.images.push(newImage as any);
    if (isCover) {
      mapping.coverImageId = newImage.id;
    }
    await mapping.save();

    // Update Category schema with cover image URL
    try {
      await this.categoryModel.findOneAndUpdate(
        { snelstartId: categoryId },
        { imageUrl: newImage.imageUrl },
        { upsert: false }
      ).exec();
    } catch (error: any) {
      console.error(`[ImagesService] Error updating Category schema:`, error.message);
    }

    // Invalidate cache to ensure fresh data
    try {
      await this.cacheService.deletePattern('categories:*');
      console.log(`[ImagesService] Cache invalidated for categories`);
    } catch (error: any) {
      console.warn(`[ImagesService] Cache invalidation failed (non-critical):`, error.message);
    }

    return newImage;
  }

  async deleteCategoryImage(categoryId: string, imageId: string): Promise<void> {
    const mapping = await this.categoryImageMappingModel
      .findOne({ snelstartCategoryId: categoryId })
      .exec();
    if (!mapping) {
      throw new NotFoundException('Category image mapping not found');
    }

    const image = mapping.images.find((img) => img.id === imageId);
    if (!image) {
      throw new NotFoundException('Image not found');
    }

    // Remove from mapping
    mapping.images = mapping.images.filter((img) => img.id !== imageId);
    if (mapping.coverImageId === imageId) {
      mapping.coverImageId = mapping.images[0]?.id;
      if (mapping.coverImageId) {
        mapping.images[0].isCover = true;
      }
    }
    await mapping.save();

    // Update Category schema
    try {
      const coverImage = mapping.images.find((img: any) => img.isCover);
      await this.categoryModel.findOneAndUpdate(
        { snelstartId: categoryId },
        { imageUrl: coverImage?.imageUrl || null },
        { upsert: false }
      ).exec();
    } catch (error: any) {
      console.error(`[ImagesService] Error updating Category schema:`, error.message);
    }

    // Invalidate cache to ensure fresh data
    try {
      await this.cacheService.deletePattern('categories:*');
      console.log(`[ImagesService] Cache invalidated for categories`);
    } catch (error: any) {
      console.warn(`[ImagesService] Cache invalidation failed (non-critical):`, error.message);
    }
  }
}

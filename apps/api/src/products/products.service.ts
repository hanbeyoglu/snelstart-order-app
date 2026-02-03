import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SnelStartService } from '../snelstart/snelstart.service';
import { PricingService } from '../pricing/pricing.service';
import { CacheService } from '../cache/cache.service';
import { CategoriesService } from '../categories/categories.service';
import { ImagesService } from '../images/images.service';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private snelStartService: SnelStartService,
    private pricingService: PricingService,
    private cacheService: CacheService,
    @Inject(forwardRef(() => CategoriesService))
    private categoriesService: CategoriesService,
    @Inject(forwardRef(() => ImagesService))
    private imagesService: ImagesService,
  ) {}

  async syncProducts(): Promise<void> {
    try {
      // Get all products from API (no filters)
      const allProducts = await this.snelStartService.getProducts();
      
      // Save to database
      await Promise.all(
        allProducts.map(async (product: any) => {
          // Extract artikelomzetgroepId from nested object if available
          const artikelomzetgroepId = product.artikelOmzetgroep?.id || product.artikelomzetgroepId;
          const artikelomzetgroepOmschrijving = product.artikelOmzetgroep?.omschrijving || product.artikelomzetgroepOmschrijving;
          
          await this.productModel.findOneAndUpdate(
            { snelstartId: product.id },
            {
              snelstartId: product.id,
              artikelnummer: product.artikelnummer,
              omschrijving: product.omschrijving,
              artikelgroepId: product.artikelgroepId,
              artikelgroepOmschrijving: product.artikelgroepOmschrijving,
              artikelomzetgroepId: artikelomzetgroepId,
              artikelomzetgroepOmschrijving: artikelomzetgroepOmschrijving,
              voorraad: product.voorraad,
              verkoopprijs: product.verkoopprijs,
              btwPercentage: product.btwPercentage,
              eenheid: product.eenheid,
              barcode: product.barcode,
              lastSyncedAt: new Date(),
            },
            { upsert: true, new: true },
          );
        }),
      );
      
      // Invalidate product cache
      await this.cacheService.invalidateProductCache();
    } catch (error) {
      console.error('Error syncing products:', error);
      throw error;
    }
  }

  async getProducts(groupId?: string, search?: string, customerId?: string, page: number = 1, limit: number = 20) {
    const cacheKey = `products:${groupId || 'all'}:${search || 'none'}:${customerId || 'none'}:${page}:${limit}`;
    
    // First check Redis cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // If search is provided, try DB first (faster)
    if (search && search.trim()) {
      const query: any = {};
      const searchLower = search.toLowerCase().trim();
      
      // Search in multiple fields
      const searchConditions = [
        { omschrijving: { $regex: searchLower, $options: 'i' } },
        { artikelnummer: { $regex: searchLower, $options: 'i' } },
        { barcode: { $regex: searchLower, $options: 'i' } },
      ];
      
      // Filter by groupId if provided
      if (groupId) {
        query.$and = [
          { $or: searchConditions },
          {
            $or: [
              { artikelgroepId: groupId },
              { artikelomzetgroepId: groupId }
            ]
          }
        ];
      } else {
        query.$or = searchConditions;
      }
      
      const total = await this.productModel.countDocuments(query).exec();
      const skip = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);
      
      const dbProducts = await this.productModel
        .find(query)
        .sort({ omschrijving: 1 })
        .skip(skip)
        .limit(limit)
        .exec();
      
      if (dbProducts.length > 0) {
        // Enrich with pricing and images
        const enrichedProducts = await Promise.all(
          dbProducts.map(async (product) => {
            const basePrice = product.verkoopprijs || 0;
            let finalPrice = basePrice;
            
            if (customerId) {
              finalPrice = await this.pricingService.calculatePrice(
                product.snelstartId,
                product.artikelgroepId,
                customerId,
                basePrice,
              );
            }

            // Get cover image - first check Product schema, then fallback to ImagesService
            let coverImageUrl = product.imageUrl || null;
            if (!coverImageUrl) {
              const coverImages = await this.imagesService.getCoverImagesForProducts([product.snelstartId]);
              coverImageUrl = coverImages[product.snelstartId] || null;
            }

            return {
              id: product.snelstartId,
              artikelnummer: product.artikelnummer,
              omschrijving: product.omschrijving,
              artikelgroepId: product.artikelgroepId,
              artikelgroepOmschrijving: product.artikelgroepOmschrijving,
              artikelomzetgroepId: product.artikelomzetgroepId,
              artikelomzetgroepOmschrijving: product.artikelomzetgroepOmschrijving,
              voorraad: product.voorraad,
              verkoopprijs: product.verkoopprijs,
              inkoopprijs: product.inkoopprijs,
              btwPercentage: product.btwPercentage,
              eenheid: product.eenheid,
              barcode: product.barcode,
              basePrice,
              finalPrice,
              coverImageUrl,
            };
          })
        );

        const result = {
          data: enrichedProducts,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        };

        // Cache with shorter TTL for search results
        await this.cacheService.set(cacheKey, result, 300); // 5 minutes
        return result;
      }
    }

    // Get all products from API (only if no search or DB search returned no results)
    // Note: groupId can be either artikelgroepId or artikelomzetgroepId
    // We'll try to match both when filtering
    let allProducts = await this.snelStartService.getProducts(groupId, search);
    
    // If groupId is provided and it's an artikelomzetgroep ID, filter by artikelomzetgroepId
    // Otherwise, filter by artikelgroepId (default behavior)
    if (groupId) {
      // Check if we need to filter by artikelomzetgroepId
      // First, try to get products with artikelgroepId matching groupId
      // If no results, try filtering by artikelomzetgroepId from DB
      const dbProducts = await this.productModel.find({ artikelomzetgroepId: groupId }).exec();
      if (dbProducts.length > 0) {
        // Filter API products by artikelomzetgroepId if available
        // Check both nested object (artikelOmzetgroep.id) and flat field (artikelomzetgroepId)
        allProducts = allProducts.filter((p: any) => 
          p.artikelOmzetgroep?.id === groupId || 
          p.artikelomzetgroepId === groupId || 
          p.artikelgroepId === groupId
        );
      }
    }
    
    // Save to database
    await Promise.all(
      allProducts.map(async (product: any) => {
        // Extract artikelomzetgroepId from nested object if available
        const artikelomzetgroepId = product.artikelOmzetgroep?.id || product.artikelomzetgroepId;
        const artikelomzetgroepOmschrijving = product.artikelOmzetgroep?.omschrijving || product.artikelomzetgroepOmschrijving;
        
        await this.productModel.findOneAndUpdate(
          { snelstartId: product.id },
          {
            snelstartId: product.id,
            artikelnummer: product.artikelnummer,
            omschrijving: product.omschrijving,
            artikelgroepId: product.artikelgroepId,
            artikelgroepOmschrijving: product.artikelgroepOmschrijving,
            artikelomzetgroepId: artikelomzetgroepId,
            artikelomzetgroepOmschrijving: artikelomzetgroepOmschrijving,
            voorraad: product.voorraad,
            verkoopprijs: product.verkoopprijs,
            inkoopprijs: product.inkoopprijs,
            btwPercentage: product.btwPercentage,
            eenheid: product.eenheid,
            barcode: product.barcode,
            lastSyncedAt: new Date(),
          },
          { upsert: true, new: true },
        );
      }),
    );
    
    // Enrich with pricing if customerId provided
    const enrichedProducts = await Promise.all(
      allProducts.map(async (product) => {
        const basePrice = product.verkoopprijs || 0;
        let finalPrice = basePrice;
        
        if (customerId) {
          finalPrice = await this.pricingService.calculatePrice(
            product.id,
            product.artikelgroepId,
            customerId,
            basePrice,
          );
        }

        return {
          ...product,
          basePrice,
          finalPrice,
        };
      }),
    );

    // Calculate pagination
    const total = enrichedProducts.length;
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);
    
    // Apply pagination
    const paginatedProducts = enrichedProducts.slice(skip, skip + limit);

    // Get cover images for paginated products
    // First, get products from DB to check imageUrl field
    const productIds = paginatedProducts.map((p) => p.id);
    const dbProductsMap = new Map<string, ProductDocument>();
    try {
      const dbProducts = await this.productModel.find({ 
        snelstartId: { $in: productIds } 
      }).exec();
      dbProducts.forEach((p) => {
        dbProductsMap.set(p.snelstartId, p);
      });
    } catch (error) {
      console.error('[ProductsService] Error getting products from DB:', error);
    }

    // Get cover images from ImagesService for products without imageUrl in Product schema
    const productIdsWithoutImage = productIds.filter((id) => {
      const dbProduct = dbProductsMap.get(id);
      return !dbProduct?.imageUrl;
    });
    
    let coverImagesMap: Record<string, string | null> = {};
    if (productIdsWithoutImage.length > 0) {
      try {
        coverImagesMap = await this.imagesService.getCoverImagesForProducts(productIdsWithoutImage);
      } catch (error) {
        console.error('[ProductsService] Error getting cover images:', error);
        // Continue without images if there's an error
      }
    }

    // Add cover images to products - prioritize Product schema imageUrl
    const productsWithImages = paginatedProducts.map((product) => {
      const dbProduct = dbProductsMap.get(product.id);
      const coverImageUrl = dbProduct?.imageUrl || coverImagesMap[product.id] || null;
      return {
        ...product,
        coverImageUrl,
      };
    });

    const result = {
      data: productsWithImages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    // Cache with longer TTL for non-search queries (15 minutes)
    const cacheTTL = search ? 300 : 900; // 5 min for search, 15 min for regular
    await this.cacheService.set(cacheKey, result, cacheTTL);
    return result;
  }

  async getProductById(id: string, customerId?: string) {
    const cacheKey = `product:${id}:${customerId || 'none'}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const product: any = await this.snelStartService.getProductById(id);
    
    // Extract artikelomzetgroepId from nested object if available
    const artikelomzetgroepId = product.artikelOmzetgroep?.id || product.artikelomzetgroepId;
    const artikelomzetgroepOmschrijving = product.artikelOmzetgroep?.omschrijving || product.artikelomzetgroepOmschrijving;
    
    // Get category name if artikelomzetgroepId exists
    let categoryName = artikelomzetgroepOmschrijving;
    if (artikelomzetgroepId && !categoryName) {
      try {
        const category = await this.categoriesService.getCategoryById(artikelomzetgroepId);
        if (category) {
          categoryName = category.omschrijving;
        }
      } catch (error) {
        // If category not found, continue without category name
        console.warn(`Category not found for artikelomzetgroepId: ${artikelomzetgroepId}`);
      }
    }
    
    // Get cover image URL from Product schema or ImagesService
    let coverImageUrl: string | null = null;
    const dbProduct = await this.productModel.findOne({ snelstartId: product.id }).exec();
    if (dbProduct?.imageUrl) {
      coverImageUrl = dbProduct.imageUrl;
    } else {
      try {
        const coverImages = await this.imagesService.getCoverImagesForProducts([product.id]);
        coverImageUrl = coverImages[product.id] || null;
      } catch (error) {
        console.error('[ProductsService] Error getting cover image:', error);
      }
    }

    // Save to database
    await this.productModel.findOneAndUpdate(
      { snelstartId: product.id },
      {
        snelstartId: product.id,
        artikelnummer: product.artikelnummer || product.artikelcode,
        omschrijving: product.omschrijving,
        artikelgroepId: product.artikelgroepId,
        artikelgroepOmschrijving: product.artikelgroepOmschrijving,
        artikelomzetgroepId: artikelomzetgroepId,
        artikelomzetgroepOmschrijving: categoryName || artikelomzetgroepOmschrijving,
        voorraad: product.voorraad,
        verkoopprijs: product.verkoopprijs,
        btwPercentage: product.btwPercentage,
        eenheid: product.eenheid,
        barcode: product.barcode,
        lastSyncedAt: new Date(),
      },
      { upsert: true, new: true },
    );
    const basePrice = product.verkoopprijs || 0;
    let finalPrice = basePrice;

    if (customerId) {
      finalPrice = await this.pricingService.calculatePrice(
        product.id,
        product.artikelgroepId,
        customerId,
        basePrice,
      );
    }

    const enriched = {
      ...product,
      basePrice,
      finalPrice,
      // Ensure artikelcode is included (use artikelcode or artikelnummer)
      artikelcode: product.artikelcode || product.artikelnummer,
      // Include category name
      artikelOmzetgroep: product.artikelOmzetgroep ? {
        ...product.artikelOmzetgroep,
        omschrijving: categoryName || product.artikelOmzetgroep.omschrijving,
      } : undefined,
      // Include prijsafspraak if available
      prijsafspraak: product.prijsafspraak,
      // Include cover image URL (from Product schema or ImagesService)
      coverImageUrl,
    };

    await this.cacheService.set(cacheKey, enriched, 300);
    return enriched;
  }
}


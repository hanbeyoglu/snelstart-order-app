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

  /**
   * Full sync: Retrieve all products using dynamic pagination
   * This method scales to any number of products (1,000, 5,000, 10,000+)
   */
  async syncProducts(): Promise<{ total: number; synced: number; updated: number; created: number }> {
    try {
      console.log('[ProductsService] Starting full product sync with dynamic pagination...');
      
      // Track sync statistics
      let synced = 0;
      let updated = 0;
      let created = 0;
      const syncedProductIds = new Set<string>();

      // Get all products using paginated API
      const allProducts = await this.snelStartService.getAllProductsPaginated(
        undefined, // No delta sync - full sync
        (current, total) => {
          console.log(`[ProductsService] Progress: ${current} products retrieved...`);
        },
      );

      console.log(`[ProductsService] Retrieved ${allProducts.length} products from API. Starting upsert...`);
      console.log(`[ProductsService] Total products to process: ${allProducts.length}`);

      // Track duplicates and errors
      const duplicateSnelstartIds = new Set<string>();
      const errorProducts: Array<{ id: string; error: string }> = [];

      // Process products in batches for better performance
      const batchSize = 100;
      let processedBatches = 0;
      
      for (let i = 0; i < allProducts.length; i += batchSize) {
        const batch = allProducts.slice(i, i + batchSize);
        processedBatches++;
        
        console.log(
          `[ProductsService] Processing batch ${processedBatches}/${Math.ceil(allProducts.length / batchSize)}: ${batch.length} products (${i + 1}-${Math.min(i + batchSize, allProducts.length)} of ${allProducts.length})`,
        );
        
        const batchResults = await Promise.allSettled(
          batch.map(async (product: any) => {
            try {
              // CRITICAL: Use ONLY snelstartId as unique identifier
              // Artikelcode may be empty or duplicate, so we cannot rely on it
              if (!product.id) {
                throw new Error('Product missing snelstartId (id field)');
              }

              // Debug tracking for specific product IDs
              const debugIds = ['bfa4d02b-73eb-4ff5-9775-c88e82ebaf80', '0a94a6da-1e67-4645-920c-bb4f9529e900'];
              const isDebugProduct = debugIds.includes(product.id);
              
              if (isDebugProduct) {
                console.log("Attempting to upsert:", product.id);
              }

          // Extract artikelomzetgroepId from nested object if available
          const artikelomzetgroepId = product.artikelOmzetgroep?.id || product.artikelomzetgroepId;
          const artikelomzetgroepOmschrijving = product.artikelOmzetgroep?.omschrijving || product.artikelomzetgroepOmschrijving;
          
              // Check if product exists - ONLY by snelstartId
              const existingProduct = await this.productModel.findOne({
              snelstartId: product.id,
              }).exec();

              // Fallback mapping: artikelnummer -> artikelcode if missing, artikelgroepId -> null if missing
              const artikelnummer = product.artikelnummer || product.artikelcode || undefined;
              const artikelgroepId = product.artikelgroepId || undefined;

              const updateData: any = {
                snelstartId: product.id, // Primary unique identifier
                artikelnummer: artikelnummer, // Fallback to artikelcode if missing
                artikelcode: product.artikelcode || artikelnummer, // May be empty or duplicate
                omschrijving: product.omschrijving,
                artikelgroepId: artikelgroepId, // Optional - may be null/undefined
                artikelgroepOmschrijving: product.artikelgroepOmschrijving,
                artikelomzetgroepId: artikelomzetgroepId,
                artikelomzetgroepOmschrijving: artikelomzetgroepOmschrijving,
                voorraad: product.voorraad,
                verkoopprijs: product.verkoopprijs,
                inkoopprijs: product.inkoopprijs,
                btwPercentage: product.btwPercentage,
                eenheid: product.eenheid,
                barcode: product.barcode,
                modifiedOn: product.modifiedOn ? new Date(product.modifiedOn) : new Date(),
                lastSyncedAt: new Date(),
                isActive: true, // Mark as active since it exists in SnelStart
              };

              if (existingProduct) {
                // Update existing product
                await this.productModel.findOneAndUpdate(
                  { snelstartId: product.id }, // Use snelstartId only
                  updateData,
                  { new: true },
                );
                updated++;
                if (isDebugProduct) {
                  console.log("Upsert success:", product.id);
                }
                return { action: 'updated', snelstartId: product.id };
              } else {
                // Create new product
                await this.productModel.create(updateData);
                created++;
                if (isDebugProduct) {
                  console.log("Upsert success:", product.id);
                }
                return { action: 'created', snelstartId: product.id };
              }
            } catch (error: any) {
              // Debug tracking for specific product IDs
              const debugIds = ['bfa4d02b-73eb-4ff5-9775-c88e82ebaf80', '0a94a6da-1e67-4645-920c-bb4f9529e900'];
              const isDebugProduct = debugIds.includes(product.id);
              
              if (isDebugProduct) {
                console.error("Upsert failed:", product.id, error);
              }
              
              // Check for duplicate key error
              if (error.code === 11000) {
                const field = Object.keys(error.keyPattern || {})[0];
                duplicateSnelstartIds.add(product.id);
                throw new Error(`Duplicate key error on ${field}: ${product.id}`);
              }
              throw error;
            }
        }),
      );

        // Process batch results
        batchResults.forEach((result, index) => {
          const product = batch[index];
          if (result.status === 'fulfilled') {
            synced++;
            syncedProductIds.add(product.id);
          } else {
            const errorMsg = result.reason?.message || 'Unknown error';
            errorProducts.push({ id: product.id, error: errorMsg });
            console.error(
              `[ProductsService] Failed to upsert product ${product.id} (${product.artikelnummer}): ${errorMsg}`,
            );
          }
        });

        console.log(
          `[ProductsService] Batch ${processedBatches} completed: synced=${synced}, updated=${updated}, created=${created}, errors=${errorProducts.length}`,
        );
      }

      // Log summary
      console.log(`[ProductsService] Upsert summary:`);
      console.log(`  - Total fetched from API: ${allProducts.length}`);
      console.log(`  - Successfully synced: ${synced}`);
      console.log(`  - Updated: ${updated}`);
      console.log(`  - Created: ${created}`);
      console.log(`  - Errors: ${errorProducts.length}`);
      if (duplicateSnelstartIds.size > 0) {
        console.warn(
          `[ProductsService] WARNING: Found ${duplicateSnelstartIds.size} duplicate snelstartId values:`,
          Array.from(duplicateSnelstartIds).slice(0, 10),
        );
      }
      if (errorProducts.length > 0) {
        console.error(`[ProductsService] Failed products (first 10):`, errorProducts.slice(0, 10));
      }

      // Verify final count in MongoDB
      const mongoCount = await this.productModel.countDocuments({}).exec();
      console.log(`[ProductsService] Final MongoDB product count: ${mongoCount}`);
      if (mongoCount !== synced) {
        console.warn(
          `[ProductsService] WARNING: MongoDB count (${mongoCount}) does not match synced count (${synced})`,
        );
      }

      // Mark products that are no longer in SnelStart as inactive (optional)
      // Only if you want to track deleted products
      const markInactive = process.env.PRODUCT_SYNC_MARK_INACTIVE === 'true';
      if (markInactive) {
        const inactiveCount = await this.productModel.updateMany(
          {
            snelstartId: { $nin: Array.from(syncedProductIds) },
            isActive: { $ne: false },
          },
          {
            $set: { isActive: false },
          },
        ).exec();
        console.log(`[ProductsService] Marked ${inactiveCount.modifiedCount} products as inactive`);
      }
      
      // Invalidate product cache
      await this.cacheService.invalidateProductCache();

      const result = {
        total: allProducts.length,
        synced,
        updated,
        created,
      };

      console.log(`[ProductsService] Sync completed:`, result);
      return result;
    } catch (error: any) {
      console.error('[ProductsService] Error syncing products:', error);
      throw error;
    }
  }

  /**
   * Delta sync: Sync only products modified since last sync
   * @param lastSyncTimestamp Last successful sync timestamp
   * @returns Sync statistics
   */
  async syncProductsDelta(lastSyncTimestamp: Date): Promise<{ total: number; synced: number; updated: number; created: number }> {
    try {
      console.log(`[ProductsService] Starting delta sync since ${lastSyncTimestamp.toISOString()}...`);
      
      let synced = 0;
      let updated = 0;
      let created = 0;
      const syncedProductIds = new Set<string>();

      // Get modified products using delta sync
      const modifiedProducts = await this.snelStartService.getAllProductsPaginated(
        lastSyncTimestamp,
        (current, total) => {
          console.log(`[ProductsService] Delta sync progress: ${current} products retrieved...`);
        },
      );

      console.log(`[ProductsService] Retrieved ${modifiedProducts.length} modified products. Starting upsert...`);

      // Track duplicates and errors
      const duplicateSnelstartIds = new Set<string>();
      const errorProducts: Array<{ id: string; error: string }> = [];

      // Process products in batches
      const batchSize = 100;
      let processedBatches = 0;
      
      for (let i = 0; i < modifiedProducts.length; i += batchSize) {
        const batch = modifiedProducts.slice(i, i + batchSize);
        processedBatches++;
        
        console.log(
          `[ProductsService] Delta sync - Processing batch ${processedBatches}/${Math.ceil(modifiedProducts.length / batchSize)}: ${batch.length} products`,
        );
        
        const batchResults = await Promise.allSettled(
          batch.map(async (product: any) => {
            try {
              // CRITICAL: Use ONLY snelstartId as unique identifier
              if (!product.id) {
                throw new Error('Product missing snelstartId (id field)');
              }

              // Debug tracking for specific product IDs
              const debugIds = ['bfa4d02b-73eb-4ff5-9775-c88e82ebaf80', '0a94a6da-1e67-4645-920c-bb4f9529e900'];
              const isDebugProduct = debugIds.includes(product.id);
              
              if (isDebugProduct) {
                console.log("Attempting to upsert:", product.id);
              }

              const artikelomzetgroepId = product.artikelOmzetgroep?.id || product.artikelomzetgroepId;
              const artikelomzetgroepOmschrijving = product.artikelOmzetgroep?.omschrijving || product.artikelomzetgroepOmschrijving;
              
              // Check if product exists - ONLY by snelstartId
              const existingProduct = await this.productModel.findOne({
                snelstartId: product.id,
              }).exec();

              // Fallback mapping: artikelnummer -> artikelcode if missing, artikelgroepId -> null if missing
              const artikelnummer = product.artikelnummer || product.artikelcode || undefined;
              const artikelgroepId = product.artikelgroepId || undefined;

              const updateData: any = {
                snelstartId: product.id, // Primary unique identifier
                artikelnummer: artikelnummer, // Fallback to artikelcode if missing
                artikelcode: product.artikelcode || artikelnummer,
                omschrijving: product.omschrijving,
                artikelgroepId: artikelgroepId, // Optional - may be null/undefined
                artikelgroepOmschrijving: product.artikelgroepOmschrijving,
                artikelomzetgroepId: artikelomzetgroepId,
                artikelomzetgroepOmschrijving: artikelomzetgroepOmschrijving,
                voorraad: product.voorraad,
                verkoopprijs: product.verkoopprijs,
                inkoopprijs: product.inkoopprijs,
                btwPercentage: product.btwPercentage,
                eenheid: product.eenheid,
                barcode: product.barcode,
                modifiedOn: product.modifiedOn ? new Date(product.modifiedOn) : new Date(),
                lastSyncedAt: new Date(),
                isActive: true,
              };

              if (existingProduct) {
                await this.productModel.findOneAndUpdate(
                  { snelstartId: product.id }, // Use snelstartId only
                  updateData,
                  { new: true },
                );
                updated++;
                if (isDebugProduct) {
                  console.log("Upsert success:", product.id);
                }
                return { action: 'updated', snelstartId: product.id };
              } else {
                await this.productModel.create(updateData);
                created++;
                if (isDebugProduct) {
                  console.log("Upsert success:", product.id);
                }
                return { action: 'created', snelstartId: product.id };
              }
            } catch (error: any) {
              // Debug tracking for specific product IDs
              const debugIds = ['bfa4d02b-73eb-4ff5-9775-c88e82ebaf80', '0a94a6da-1e67-4645-920c-bb4f9529e900'];
              const isDebugProduct = debugIds.includes(product.id);
              
              if (isDebugProduct) {
                console.error("Upsert failed:", product.id, error);
              }
              
              // Check for duplicate key error
              if (error.code === 11000) {
                const field = Object.keys(error.keyPattern || {})[0];
                duplicateSnelstartIds.add(product.id);
                throw new Error(`Duplicate key error on ${field}: ${product.id}`);
              }
              throw error;
            }
          }),
        );

        // Process batch results
        batchResults.forEach((result, index) => {
          const product = batch[index];
          if (result.status === 'fulfilled') {
            synced++;
            syncedProductIds.add(product.id);
          } else {
            const errorMsg = result.reason?.message || 'Unknown error';
            errorProducts.push({ id: product.id, error: errorMsg });
            console.error(
              `[ProductsService] Delta sync - Failed to upsert product ${product.id}: ${errorMsg}`,
            );
          }
        });
      }

      // Log summary
      console.log(`[ProductsService] Delta sync summary:`);
      console.log(`  - Total fetched from API: ${modifiedProducts.length}`);
      console.log(`  - Successfully synced: ${synced}`);
      console.log(`  - Updated: ${updated}`);
      console.log(`  - Created: ${created}`);
      console.log(`  - Errors: ${errorProducts.length}`);
      if (duplicateSnelstartIds.size > 0) {
        console.warn(
          `[ProductsService] WARNING: Found ${duplicateSnelstartIds.size} duplicate snelstartId values`,
        );
      }
      if (errorProducts.length > 0) {
        console.error(`[ProductsService] Failed products (first 10):`, errorProducts.slice(0, 10));
      }

      // Verify MongoDB count (total products, not just delta)
      const mongoCount = await this.productModel.countDocuments({}).exec();
      console.log(`[ProductsService] Total MongoDB product count after delta sync: ${mongoCount}`);

      await this.cacheService.invalidateProductCache();

      const result = {
        total: modifiedProducts.length,
        synced,
        updated,
        created,
      };

      console.log(`[ProductsService] Delta sync completed:`, result);
      return result;
    } catch (error: any) {
      console.error('[ProductsService] Error in delta sync:', error);
      throw error;
    }
  }

  /** Sort options: name_asc, name_desc, price_asc, price_desc, stock_desc */
  private getSortObject(sortBy?: string): Record<string, 1 | -1> {
    switch (sortBy) {
      case 'name_desc':
        return { omschrijving: -1 };
      case 'price_asc':
        return { verkoopprijs: 1, omschrijving: 1 };
      case 'price_desc':
        return { verkoopprijs: -1, omschrijving: 1 };
      case 'stock_desc':
        return { voorraad: -1, omschrijving: 1 };
      case 'name_asc':
      default:
        return { omschrijving: 1 };
    }
  }

  async getProducts(
    groupIds?: string[],
    search?: string,
    customerId?: string,
    page: number = 1,
    limit: number = 20,
    sortBy?: string,
    inStockOnly: boolean = false,
  ) {
    const groupIdsKey = groupIds?.length ? groupIds.slice().sort().join(',') : 'all';
    const cacheKey = `products:${groupIdsKey}:${search || 'none'}:${customerId || 'none'}:${page}:${limit}:${sortBy || 'name_asc'}:${inStockOnly}`;

    // First check Redis cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const sort = this.getSortObject(sortBy);

    // If search is provided, try DB first (faster)
    if (search && search.trim()) {
      // Build query with isActive filter - only exclude products explicitly marked as inactive
      const query: any = {
        $and: [
          { isActive: { $ne: false } }, // Include all except isActive: false
        ],
      };

      const searchLower = search.toLowerCase().trim();

      // Search in multiple fields
      const searchConditions = [
        { omschrijving: { $regex: searchLower, $options: 'i' } },
        { artikelnummer: { $regex: searchLower, $options: 'i' } },
        { barcode: { $regex: searchLower, $options: 'i' } },
      ];

      query.$and.push({ $or: searchConditions });

      // Filter by groupIds if provided (any of the categories)
      if (groupIds?.length) {
        query.$and.push({
          $or: [
            { artikelgroepId: { $in: groupIds } },
            { artikelomzetgroepId: { $in: groupIds } },
          ],
        });
      }

      // Sadece stokta olanlar
      if (inStockOnly) {
        query.$and.push({ voorraad: { $gt: 0 } });
      }

      const total = await this.productModel.countDocuments(query).exec();
      const skip = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      const dbProducts = await this.productModel
        .find(query)
        .sort(sort)
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

    // IMPORTANT: Search must ONLY use MongoDB, never call SnelStart API
    // All products should be synced to MongoDB first via syncProducts()
    // If no results found in DB, return empty results (don't call API)
    
    // Build query for MongoDB-only search
    // IMPORTANT: Only filter out products explicitly marked as inactive (isActive: false)
    // Use $ne: false to include all products except those explicitly set to false
    // This includes: undefined, null, true, and any other value
    const query: any = {
      isActive: { $ne: false }, // Include all except isActive: false
    };
    
    // Filter by groupIds if provided (product in any of the categories)
    if (groupIds?.length) {
      query.$and = [
        { isActive: { $ne: false } },
        {
          $or: [
            { artikelgroepId: { $in: groupIds } },
            { artikelomzetgroepId: { $in: groupIds } },
          ],
        },
      ];
      delete query.isActive; // Remove from root since it's in $and
    }
    
    // Apply search if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      const searchConditions = [
        { omschrijving: { $regex: searchLower, $options: 'i' } },
        { artikelnummer: { $regex: searchLower, $options: 'i' } },
        { barcode: { $regex: searchLower, $options: 'i' } },
      ];

      if (query.$and) {
        // If groupId filter exists, add search to $and
        query.$and.push({ $or: searchConditions });
      } else {
        // Combine isActive filter with search
        query.$and = [
          { isActive: { $ne: false } },
          { $or: searchConditions },
        ];
        delete query.isActive;
      }
    }

    // Sadece stokta olanlar
    if (inStockOnly) {
      if (!query.$and) {
        query.$and = [{ isActive: { $ne: false } }, { voorraad: { $gt: 0 } }];
        delete query.isActive;
      } else {
        query.$and.push({ voorraad: { $gt: 0 } });
      }
    }

    const total = await this.productModel.countDocuments(query).exec();
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Debug logging
    console.log(`[ProductsService] getProducts query:`, JSON.stringify(query, null, 2));
    console.log(`[ProductsService] getProducts - page=${page}, limit=${limit}, total=${total}, totalPages=${totalPages}`);

    const dbProducts = await this.productModel
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit) // Use provided limit (no hard cap - pagination handles it)
      .exec();
    
    console.log(`[ProductsService] getProducts - found ${dbProducts.length} products in DB`);
    
    // If no products found in DB, return empty (don't call API)
    if (dbProducts.length === 0) {
      const emptyResult = {
        data: [],
        products: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
      await this.cacheService.set(cacheKey, emptyResult, 300); // Cache for 5 minutes
      return emptyResult;
    }
    
    // Process products (enrich with pricing and images)
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

        // Get cover image
        let coverImageUrl = product.imageUrl || null;
        if (!coverImageUrl) {
          const coverImages = await this.imagesService.getCoverImagesForProducts([product.snelstartId]);
          coverImageUrl = coverImages[product.snelstartId] || null;
        }

        return {
          id: product.snelstartId,
          artikelnummer: product.artikelnummer,
          artikelcode: product.artikelcode,
          omschrijving: product.omschrijving,
          artikelgroepId: product.artikelgroepId,
          artikelgroepOmschrijving: product.artikelgroepOmschrijving,
          artikelomzetgroepId: product.artikelomzetgroepId,
          artikelomzetgroepOmschrijving: product.artikelomzetgroepOmschrijving,
          voorraad: product.voorraad,
          basePrice,
          finalPrice,
          btwPercentage: product.btwPercentage,
          eenheid: product.eenheid,
          barcode: product.barcode,
          coverImageUrl,
        };
      }),
    );

    const result = {
      data: enrichedProducts, // Keep 'data' for backward compatibility
      products: enrichedProducts, // Also include 'products' for clarity
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

  /**
   * Ürünler: Satış fiyatı < Alış fiyatı VEYA kar marjı <%5 olanlar.
   * Marj = (satış - alış) / alış * 100
   */
  async getPriceWarnings(page: number = 1, limit: number = 50) {
    const dbProducts = await this.productModel
      .find({ isActive: { $ne: false }, inkoopprijs: { $gt: 0 } })
      .select('snelstartId omschrijving artikelnummer verkoopprijs inkoopprijs artikelgroepOmschrijving voorraad')
      .lean()
      .exec();

    const warnings: any[] = [];
    for (const p of dbProducts as any[]) {
      const sales = p.verkoopprijs ?? 0;
      const purchase = p.inkoopprijs ?? 0;
      if (purchase <= 0) continue;

      const isLoss = sales < purchase;
      const marginPct = ((sales - purchase) / purchase) * 100;
      const isLowMargin = marginPct < 5;

      if (isLoss || isLowMargin) {
        const minPrice = Math.round(purchase * 1.05 * 100) / 100;
        warnings.push({
          ...p,
          id: p.snelstartId,
          marginPct,
          warningType: isLoss ? 'zarar' : 'dusuk-marj',
          minPrice,
        });
      }
    }

    warnings.sort((a, b) => a.marginPct - b.marginPct);

    const total = warnings.length;
    const skip = (page - 1) * limit;
    const pageItems = warnings.slice(skip, skip + limit);

    const ids = pageItems.map((x) => x.snelstartId);
    const coverImages = ids.length
      ? await this.imagesService.getCoverImagesForProducts(ids)
      : {};

    const data = pageItems.map((p) => ({
      id: p.snelstartId,
      omschrijving: p.omschrijving,
      artikelnummer: p.artikelnummer,
      verkoopprijs: p.verkoopprijs,
      inkoopprijs: p.inkoopprijs,
      minPrice: p.minPrice,
      marginPct: p.marginPct,
      warningType: p.warningType,
      artikelgroepOmschrijving: p.artikelgroepOmschrijving,
      voorraad: p.voorraad,
      coverImageUrl: coverImages[p.snelstartId] || null,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
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

    // Fallback mapping: artikelnummer -> artikelcode if missing, artikelgroepId -> null if missing
    const artikelnummer = product.artikelnummer || product.artikelcode || undefined;
    const artikelgroepId = product.artikelgroepId || undefined;

    // Save to database
    await this.productModel.findOneAndUpdate(
      { snelstartId: product.id },
      {
        snelstartId: product.id,
        artikelnummer: artikelnummer, // Fallback to artikelcode if missing
        artikelcode: product.artikelcode || artikelnummer, // Store artikelcode separately
        omschrijving: product.omschrijving,
        artikelgroepId: artikelgroepId, // Optional - may be null/undefined
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

  /**
   * Get the timestamp of the last successful product sync
   * Used for delta sync
   */
  async getLastSyncTimestamp(): Promise<Date> {
    const lastSyncedProduct = await this.productModel
      .findOne({ lastSyncedAt: { $exists: true } })
      .sort({ lastSyncedAt: -1 })
      .select('lastSyncedAt')
      .exec();

    if (lastSyncedProduct && lastSyncedProduct.lastSyncedAt) {
      return lastSyncedProduct.lastSyncedAt;
    }

    // If no sync found, return a date from 7 days ago as default
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 7);
    return defaultDate;
  }
}


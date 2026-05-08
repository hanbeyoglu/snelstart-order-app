import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SnelStartService } from '../snelstart/snelstart.service';
import { CacheService } from '../cache/cache.service';
import { SnelStartProductGroup, SnelStartArtikelOmzetGroep } from '@snelstart-order-app/shared';
import { Category, CategoryDocument } from './schemas/category.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private snelStartService: SnelStartService,
    private cacheService: CacheService,
  ) {}

  private buildCategoryUpsert(groep: SnelStartArtikelOmzetGroep) {
    return {
      $set: {
        snelstartId: groep.id,
        nummer: groep.nummer,
        omschrijving: groep.omschrijving,
        verkoopNederlandBtwSoort: groep.verkoopNederlandBtwSoort,
        verkoopGrootboekNederlandIdentifier: groep.verkoopGrootboekNederlandIdentifier,
        uri: groep.uri,
        lastSyncedAt: new Date(),
      },
      $setOnInsert: {
        isActive: true,
      },
    };
  }

  private async ensureSyncedCategories(): Promise<void> {
    const artikelOmzetGroepen = await this.snelStartService.getArtikelOmzetGroepen();

    await Promise.all(
      artikelOmzetGroepen.map(async (groep) => {
        await this.categoryModel.findOneAndUpdate(
          { snelstartId: groep.id },
          this.buildCategoryUpsert(groep),
          { upsert: true, new: true },
        );
      }),
    );

    await this.cacheService.delete('categories:active-ids');
  }

  private mapCategory(category: any, productCount: number) {
    return {
      id: category.snelstartId,
      nummer: category.nummer,
      omschrijving: category.omschrijving,
      verkoopNederlandBtwSoort: category.verkoopNederlandBtwSoort,
      uri: category.uri,
      productCount,
      coverImageUrl: category.imageUrl || null,
      isActive: category.isActive !== false,
    };
  }

  async syncCategories(): Promise<void> {
    try {
      await this.ensureSyncedCategories();
      
      // Invalidate cache
      await this.cacheService.invalidateCatalogCache();
    } catch (error) {
      console.error('Error syncing categories:', error);
      throw error;
    }
  }

  async getCategories(includeInactive = false): Promise<any[]> {
    const cacheKey = `categories:artikelomzetgroepen:${includeInactive ? 'all' : 'active'}`;
    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.ensureSyncedCategories();

    const categoryQuery = includeInactive ? {} : { isActive: { $ne: false } };
    const categories = await this.categoryModel
      .find(categoryQuery)
      .sort({ omschrijving: 1 })
      .lean()
      .exec();
    
    // Get product counts and cover images for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        // Count products with matching artikelomzetgroepId
        const productCount = await this.productModel.countDocuments({
          artikelomzetgroepId: category.snelstartId,
          isActive: { $ne: false },
        }).exec();

        return this.mapCategory(category, productCount);
      }),
    );

    await this.cacheService.set(cacheKey, categoriesWithCounts, 600); // 10 min cache
    return categoriesWithCounts;
  }

  async getCategoryById(id: string): Promise<any> {
    const categories = await this.getCategories();
    return categories.find((cat) => cat.id === id);
  }

  async getActiveCategoryIds(): Promise<string[]> {
    const cacheKey = 'categories:active-ids';
    const cached = await this.cacheService.get<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await this.categoryModel
      .find({ isActive: { $ne: false } })
      .select('snelstartId')
      .lean()
      .exec();
    const ids = categories.map((category) => category.snelstartId);

    await this.cacheService.set(cacheKey, ids, 600);
    return ids;
  }

  async getCategoryVisibility(
    search?: string,
    status: 'all' | 'active' | 'inactive' = 'all',
    page: number = 1,
    limit: number = 25,
  ) {
    await this.ensureSyncedCategories();

    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.min(Math.max(1, limit || 25), 100);
    const query: any = {};

    if (status === 'active') {
      query.isActive = { $ne: false };
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { omschrijving: { $regex: term, $options: 'i' } },
        { snelstartId: { $regex: term, $options: 'i' } },
      ];

      const numericTerm = Number(term);
      if (!Number.isNaN(numericTerm)) {
        query.$or.push({ nummer: numericTerm });
      }
    }

    const total = await this.categoryModel.countDocuments(query).exec();
    const totalPages = Math.ceil(total / safeLimit);
    const categories = await this.categoryModel
      .find(query)
      .sort({ omschrijving: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean()
      .exec();

    const data = await Promise.all(
      categories.map(async (category) => {
        const productCount = await this.productModel.countDocuments({
          artikelomzetgroepId: category.snelstartId,
          isActive: { $ne: false },
        }).exec();

        return this.mapCategory(category, productCount);
      }),
    );

    return {
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    };
  }

  async updateCategoryVisibility(id: string, isActive: boolean) {
    const category = await this.categoryModel
      .findOneAndUpdate(
        { snelstartId: id },
        { $set: { isActive } },
        { new: true },
      )
      .lean()
      .exec();

    if (!category) {
      return null;
    }

    await this.cacheService.invalidateCatalogCache();

    const productCount = await this.productModel.countDocuments({
      artikelomzetgroepId: category.snelstartId,
      isActive: { $ne: false },
    }).exec();

    return this.mapCategory(category, productCount);
  }

  // Legacy method for artikelgroepen (if still needed)
  async getProductGroups(): Promise<SnelStartProductGroup[]> {
    const cacheKey = 'categories:artikelgroepen:all';
    const cached = await this.cacheService.get<SnelStartProductGroup[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const groups = await this.snelStartService.getProductGroups();
    
    // Build hierarchical structure
    const categoryMap = new Map<string, SnelStartProductGroup & { children?: SnelStartProductGroup[] }>();
    const rootCategories: SnelStartProductGroup[] = [];

    // First pass: create map
    groups.forEach((group) => {
      categoryMap.set(group.id, { ...group, children: [] });
    });

    // Second pass: build tree
    groups.forEach((group) => {
      const category = categoryMap.get(group.id)!;
      if (group.parentId && categoryMap.has(group.parentId)) {
        const parent = categoryMap.get(group.parentId)!;
        if (!parent.children) parent.children = [];
        parent.children.push(category);
      } else {
        rootCategories.push(category);
      }
    });

    await this.cacheService.set(cacheKey, rootCategories, 600); // 10 min cache
    return rootCategories;
  }
}

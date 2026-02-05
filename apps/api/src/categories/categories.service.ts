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

  async syncCategories(): Promise<void> {
    try {
      // Get artikelomzetgroepen from /v2/artikelen or /v2/artikelomzetgroepen
      const artikelOmzetGroepen = await this.snelStartService.getArtikelOmzetGroepen();
      
      // Save to database
      await Promise.all(
        artikelOmzetGroepen.map(async (groep) => {
          await this.categoryModel.findOneAndUpdate(
            { snelstartId: groep.id },
            {
              snelstartId: groep.id,
              nummer: groep.nummer,
              omschrijving: groep.omschrijving,
              verkoopNederlandBtwSoort: groep.verkoopNederlandBtwSoort,
              verkoopGrootboekNederlandIdentifier: groep.verkoopGrootboekNederlandIdentifier,
              uri: groep.uri,
              lastSyncedAt: new Date(),
            },
            { upsert: true, new: true },
          );
        }),
      );
      
      // Invalidate cache
      await this.cacheService.delete('categories:artikelomzetgroepen:all');
    } catch (error) {
      console.error('Error syncing categories:', error);
      throw error;
    }
  }

  async getCategories(): Promise<any[]> {
    const cacheKey = 'categories:artikelomzetgroepen:all';
    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get artikelomzetgroepen from /v2/artikelen or /v2/artikelomzetgroepen
    const artikelOmzetGroepen = await this.snelStartService.getArtikelOmzetGroepen();
    
    // Save to database
    await Promise.all(
      artikelOmzetGroepen.map(async (groep) => {
        await this.categoryModel.findOneAndUpdate(
          { snelstartId: groep.id },
          {
            snelstartId: groep.id,
            nummer: groep.nummer,
            omschrijving: groep.omschrijving,
            verkoopNederlandBtwSoort: groep.verkoopNederlandBtwSoort,
            verkoopGrootboekNederlandIdentifier: groep.verkoopGrootboekNederlandIdentifier,
            uri: groep.uri,
            lastSyncedAt: new Date(),
          },
          { upsert: true, new: true },
        );
      }),
    );
    
    // Get product counts and cover images for each category
    const categoriesWithCounts = await Promise.all(
      artikelOmzetGroepen.map(async (groep) => {
        // Count products with matching artikelomzetgroepId
        const productCount = await this.productModel.countDocuments({
          artikelomzetgroepId: groep.id,
        }).exec();

        // Get category from database to get imageUrl
        const category = await this.categoryModel.findOne({ snelstartId: groep.id }).exec();

        return {
          id: groep.id,
          nummer: groep.nummer,
          omschrijving: groep.omschrijving,
          verkoopNederlandBtwSoort: groep.verkoopNederlandBtwSoort,
          uri: groep.uri,
          productCount,
          coverImageUrl: category?.imageUrl || null,
        };
      }),
    );

    await this.cacheService.set(cacheKey, categoriesWithCounts, 600); // 10 min cache
    return categoriesWithCounts;
  }

  async getCategoryById(id: string): Promise<any> {
    const categories = await this.getCategories();
    return categories.find((cat) => cat.id === id);
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


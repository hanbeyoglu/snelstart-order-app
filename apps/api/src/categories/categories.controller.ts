import { Controller, Get, Param, Post, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductsService } from '../products/products.service';

@ApiTags('Categories')
@Controller('categories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(
    private categoriesService: CategoriesService,
    @Inject(forwardRef(() => ProductsService))
    private productsService: ProductsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories (hierarchical)' })
  async getCategories() {
    return this.categoriesService.getCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  async getCategoryById(@Param('id') id: string) {
    return this.categoriesService.getCategoryById(id);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync categories and products from SnelStart API' })
  async syncCategories() {
    try {
      // Sync categories first
      await this.categoriesService.syncCategories();
      
      // Then sync products
      await this.productsService.syncProducts();
      
      return {
        success: true,
        message: 'Kategoriler ve ürünler başarıyla senkronize edildi',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Senkronizasyon sırasında bir hata oluştu',
      };
    }
  }
}


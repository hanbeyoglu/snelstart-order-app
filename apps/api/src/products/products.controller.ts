import { Controller, Get, Param, Query, Post, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CategoriesService } from '../categories/categories.service';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    @Inject(forwardRef(() => CategoriesService))
    private categoriesService: CategoriesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get products (optionally filtered by group or search) with pagination' })
  async getProducts(
    @Query('groupId') groupId?: string,
    @Query('search') search?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.productsService.getProducts(groupId, search, customerId, pageNum, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  async getProductById(
    @Param('id') id: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.productsService.getProductById(id, customerId);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync products and categories from SnelStart API' })
  async syncProductsAndCategories() {
    try {
      // Sync categories first
      await this.categoriesService.syncCategories();
      
      // Then sync products
      await this.productsService.syncProducts();
      
      return {
        success: true,
        message: 'Ürünler ve kategoriler başarıyla senkronize edildi',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Senkronizasyon sırasında bir hata oluştu',
      };
    }
  }
}


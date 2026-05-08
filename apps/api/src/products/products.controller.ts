import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  Post,
  UseGuards,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CategoriesService } from '../categories/categories.service';
import { VisibilityDto } from '../common/dto/common.dto';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    @Inject(forwardRef(() => CategoriesService))
    private categoriesService: CategoriesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get products (optionally filtered by group(s), search, stock) with pagination and sort' })
  async getProducts(
    @Query('groupId') groupId?: string,
    @Query('groupIds') groupIdsParam?: string,
    @Query('search') search?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('inStockOnly') inStockOnly?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const inStock = inStockOnly === 'true' || inStockOnly === '1';
    const groupIds = groupIdsParam
      ? groupIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
      : groupId
        ? [groupId]
        : undefined;
    return this.productsService.getProducts(groupIds, search, customerId, pageNum, limitNum, sortBy, inStock);
  }

  @Get('price-warnings')
  @ApiOperation({ summary: 'Ürünler: Satış < Alış veya kar marjı <%5' })
  async getPriceWarnings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.productsService.getPriceWarnings(pageNum, limitNum);
  }

  @Get('visibility')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin: Get all products for visibility management' })
  async getProductVisibility(
    @Query('search') search?: string,
    @Query('status') status?: 'all' | 'active' | 'inactive',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 25;
    const normalizedStatus = ['active', 'inactive', 'all'].includes(status || '')
      ? status
      : 'all';

    return this.productsService.getProductVisibility(
      search,
      normalizedStatus as 'all' | 'active' | 'inactive',
      pageNum,
      limitNum,
    );
  }

  @Patch(':id/visibility')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin: Update product visibility' })
  async updateProductVisibility(
    @Param('id') id: string,
    @Body() body: VisibilityDto,
  ) {
    const updated = await this.productsService.updateProductVisibility(id, body.isActive === true);
    if (!updated) {
      throw new NotFoundException('Product not found');
    }
    return updated;
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
  @Roles('admin')
  @ApiOperation({ summary: 'Full sync: Sync all products and categories from SnelStart API using dynamic pagination' })
  async syncProductsAndCategories() {
    try {
      // Sync categories first
      await this.categoriesService.syncCategories();
      
      // Then sync products (full sync with dynamic pagination)
      const result = await this.productsService.syncProducts();
      
      return {
        success: true,
        message: 'Ürünler ve kategoriler başarıyla senkronize edildi',
        stats: result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Senkronizasyon sırasında bir hata oluştu',
      };
    }
  }

  @Post('sync/delta')
  @Roles('admin')
  @ApiOperation({ summary: 'Delta sync: Sync only products modified since last sync' })
  async syncProductsDelta(@Query('since') since?: string) {
    try {
      let lastSyncTimestamp: Date;
      
      if (since) {
        // Use provided timestamp
        lastSyncTimestamp = new Date(since);
      } else {
        // Get last sync timestamp from most recently synced product
        lastSyncTimestamp = await this.productsService.getLastSyncTimestamp();
      }
      
      if (!lastSyncTimestamp || isNaN(lastSyncTimestamp.getTime())) {
        // If no last sync found, do full sync instead
        return this.syncProductsAndCategories();
      }
      
      const result = await this.productsService.syncProductsDelta(lastSyncTimestamp);
      
      return {
        success: true,
        message: 'Değişen ürünler başarıyla senkronize edildi',
        stats: result,
        lastSyncTimestamp: lastSyncTimestamp.toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Delta senkronizasyon sırasında bir hata oluştu',
      };
    }
  }
}

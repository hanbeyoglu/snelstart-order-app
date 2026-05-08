import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Inject,
  forwardRef,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProductsService } from '../products/products.service';
import { VisibilityDto } from '../common/dto/common.dto';
import { AuditService } from '../audit/audit.service';

@ApiTags('Categories')
@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(
    private categoriesService: CategoriesService,
    @Inject(forwardRef(() => ProductsService))
    private productsService: ProductsService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories (hierarchical)' })
  async getCategories() {
    return this.categoriesService.getCategories();
  }

  @Get('visibility')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin: Get all categories for visibility management' })
  async getCategoryVisibility(
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

    return this.categoriesService.getCategoryVisibility(
      search,
      normalizedStatus as 'all' | 'active' | 'inactive',
      pageNum,
      limitNum,
    );
  }

  @Patch(':id/visibility')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin: Update category visibility' })
  async updateCategoryVisibility(
    @Param('id') id: string,
    @Body() body: VisibilityDto,
    @Request() req: any,
  ) {
    const updated = await this.categoriesService.updateCategoryVisibility(id, body.isActive === true);
    if (!updated) {
      throw new NotFoundException('Category not found');
    }
    await this.auditService.log({
      action: 'CATEGORY_VISIBILITY_UPDATED',
      entityType: 'Category',
      entityId: id,
      userId: req.user.userId,
      changes: { isActive: body.isActive === true },
    });
    return updated;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  async getCategoryById(@Param('id') id: string) {
    return this.categoriesService.getCategoryById(id);
  }

  @Post('sync')
  @Roles('admin')
  @ApiOperation({ summary: 'Sync categories and products from SnelStart API' })
  async syncCategories(@Request() req: any) {
    try {
      // Sync categories first
      await this.categoriesService.syncCategories();
      
      // Then sync products
      await this.productsService.syncProducts();
      
      await this.auditService.log({
        action: 'CATEGORIES_SYNCED',
        entityType: 'Category',
        entityId: 'bulk',
        userId: req.user.userId,
      });

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

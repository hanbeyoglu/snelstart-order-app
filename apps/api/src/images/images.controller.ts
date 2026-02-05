import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ImagesService } from './images.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Images')
@Controller('images')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ImagesController {
  constructor(private imagesService: ImagesService) {}

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get all images for a product' })
  async getImages(@Param('productId') productId: string) {
    return this.imagesService.getImages(productId);
  }

  @Put('product/:productId/cover/:imageId')
  @Roles('admin')
  @ApiOperation({ summary: 'Set cover image' })
  async setCoverImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    await this.imagesService.setCoverImage(productId, imageId);
    return { success: true };
  }

  @Delete('product/:productId/:imageId')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete image' })
  async deleteImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    await this.imagesService.deleteImage(productId, imageId);
    return { success: true };
  }

  @Post('product/:productId/url')
  @Roles('admin')
  @ApiOperation({ summary: 'Add image by URL (R2 CDN URL or external URL)' })
  async addImageByUrl(
    @Param('productId') productId: string,
    @Body() body: { imageUrl: string; isCover?: boolean },
  ) {
    if (!body.imageUrl) {
      throw new Error('imageUrl is required');
    }
    return this.imagesService.addImageByUrl(productId, body.imageUrl, body.isCover === true);
  }

  // Category Image Endpoints
  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get all images for a category' })
  async getCategoryImages(@Param('categoryId') categoryId: string) {
    return this.imagesService.getCategoryImages(categoryId);
  }

  @Post('category/:categoryId/url')
  @Roles('admin')
  @ApiOperation({ summary: 'Add category image by URL (R2 CDN URL or external URL)' })
  async addCategoryImageByUrl(
    @Param('categoryId') categoryId: string,
    @Body() body: { imageUrl: string; isCover?: boolean },
  ) {
    if (!body.imageUrl) {
      throw new Error('imageUrl is required');
    }
    return this.imagesService.addCategoryImageByUrl(categoryId, body.imageUrl, body.isCover === true);
  }

  @Delete('category/:categoryId/:imageId')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete category image' })
  async deleteCategoryImage(
    @Param('categoryId') categoryId: string,
    @Param('imageId') imageId: string,
  ) {
    await this.imagesService.deleteCategoryImage(categoryId, imageId);
    return { success: true };
  }
}


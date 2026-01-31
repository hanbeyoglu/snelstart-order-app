import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { priceOverrideRuleSchema } from '@snelstart-order-app/shared';

@ApiTags('Pricing')
@Controller('pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PricingController {
  constructor(private pricingService: PricingService) {}

  @Get('rules')
  @ApiOperation({ summary: 'Get all price override rules' })
  async getRules(@Query('productId') productId?: string) {
    const filters: any = {};
    if (productId) filters.productId = productId;
    return this.pricingService.getRules(filters);
  }

  @Post('rules')
  @Roles('admin')
  @ApiOperation({ summary: 'Create price override rule' })
  async createRule(@Body() body: any) {
    const validated = priceOverrideRuleSchema.parse(body);
    return this.pricingService.createRule(validated);
  }

  @Put('rules/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update price override rule' })
  async updateRule(@Param('id') id: string, @Body() body: any) {
    const validated = priceOverrideRuleSchema.partial().parse(body);
    return this.pricingService.updateRule(id, validated);
  }

  @Delete('rules/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete price override rule' })
  async deleteRule(@Param('id') id: string) {
    return this.pricingService.deleteRule(id);
  }
}


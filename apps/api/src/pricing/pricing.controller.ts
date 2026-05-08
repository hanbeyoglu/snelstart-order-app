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
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { priceOverrideRuleSchema } from '@snelstart-order-app/shared';
import { parseOrBadRequest } from '../common/validation/zod-validation';

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
  async createRule(@Body() body: any, @Request() req: any) {
    const validated = parseOrBadRequest(priceOverrideRuleSchema, body);
    return this.pricingService.createRule(validated, req.user.userId);
  }

  @Put('rules/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update price override rule' })
  async updateRule(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const validated = parseOrBadRequest(priceOverrideRuleSchema.partial(), body);
    return this.pricingService.updateRule(id, validated, req.user.userId);
  }

  @Delete('rules/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete price override rule' })
  async deleteRule(@Param('id') id: string, @Request() req: any) {
    return this.pricingService.deleteRule(id, req.user.userId);
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ReportType } from './types/report.types';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  /**
   * GET /api/reports/orders
   * Query: type=orders|top-products, tenantId?, siteId?, startDate?, endDate?, skip?, top?
   * SECURITY: Only super_admin can access.
   */
  @Get('orders')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Get orders or top products report (super_admin only)' })
  async getReport(
    @Query('type') type: ReportType = 'orders',
    @Query('tenantId') tenantId?: string,
    @Query('siteId') siteId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('skip') skip?: number,
    @Query('top') top?: number,
    @Query('purchasePriceFilter') purchasePriceFilter?: 'all' | 'with-price' | 'without-price',
  ) {
    const query = {
      type,
      tenantId,
      siteId,
      startDate,
      endDate,
      skip: skip !== undefined ? Number(skip) : 0,
      top: top !== undefined ? Number(top) : 100,
      purchasePriceFilter: purchasePriceFilter || 'all',
    };
    return this.reportsService.getReportData(query);
  }
}

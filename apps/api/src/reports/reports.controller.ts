import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ReportType } from './types/report.types';
import { AuditService } from '../audit/audit.service';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(
    private reportsService: ReportsService,
    private auditService: AuditService,
  ) {}

  @Get('advanced')
  @Roles('admin')
  @ApiOperation({ summary: 'Get advanced analytics report (admin only)' })
  async getAdvancedReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('customerId') customerId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('productId') productId?: string,
    @Query('search') search?: string,
    @Query('skip') skip?: number,
    @Query('top') top?: number,
    @Query('purchasePriceFilter') purchasePriceFilter?: 'all' | 'with-price' | 'without-price',
    @Query('profitFilter') profitFilter?: 'all' | 'profitable' | 'loss' | 'missing-cost',
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.reportsService.getAdvancedReport({
      startDate,
      endDate,
      customerId,
      categoryId,
      productId,
      search,
      skip: skip !== undefined ? Number(skip) : 0,
      top: top !== undefined ? Number(top) : 100,
      purchasePriceFilter: purchasePriceFilter || 'all',
      profitFilter: profitFilter || 'all',
      sortBy,
      sortDir,
    });
  }

  @Post('export-audit')
  @Roles('admin')
  @ApiOperation({ summary: 'Audit a reports export action' })
  async auditExport(@Body() body: any, @Request() req: any) {
    await this.auditService.log({
      action: 'REPORT_EXPORTED',
      entityType: 'Report',
      entityId: body?.reportType || 'advanced',
      userId: req.user?.userId,
      ...this.auditService.requestContext(req),
      metadata: {
        format: body?.format,
        filters: body?.filters,
        visibleRows: body?.visibleRows,
      },
    });
    return { success: true };
  }

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

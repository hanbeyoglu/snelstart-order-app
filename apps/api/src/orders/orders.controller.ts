import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, Req, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create order' })
  async createOrder(@Body() body: any, @Req() req: any) {
    return this.ordersService.createOrder(body, req.user);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats(@Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily', @Req() req: any) {
    return this.ordersService.getDashboardStats(period, req.user);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming (future-dated scheduled) orders' })
  async getUpcomingOrders(
    @Query('deliveryDateFrom') deliveryDateFrom: string | undefined,
    @Query('deliveryDateTo') deliveryDateTo: string | undefined,
    @Query('customerId') customerId: string | undefined,
    @Query('deliveryType') deliveryType: string | undefined,
    @Query('status') status: string | undefined,
    @Query('search') search: string | undefined,
    @Query('quickFilter') quickFilter: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    const filters: Record<string, any> = {};
    if (deliveryDateFrom) filters.deliveryDateFrom = deliveryDateFrom;
    if (deliveryDateTo) filters.deliveryDateTo = deliveryDateTo;
    if (customerId) filters.customerId = customerId;
    if (deliveryType) filters.deliveryType = deliveryType;
    if (status) filters.status = status;
    if (search) filters.search = search;
    if (quickFilter) filters.quickFilter = quickFilter;
    if (page !== undefined) filters.page = Number(page);
    if (limit !== undefined) filters.limit = Number(limit);
    return this.ordersService.getUpcomingOrders(filters, req.user);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get orders' })
  async getOrders(
    @Query('status') status: string | undefined,
    @Query('deliveryType') deliveryType: string | undefined,
    @Query('deliveryTiming') deliveryTiming: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @Query('search') search: string | undefined,
    @Query('customerId') customerId: string | undefined,
    @Query('sort') sort: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    const filters: Record<string, any> = {};
    if (status) filters.status = status;
    if (deliveryType) filters.deliveryType = deliveryType;
    if (deliveryTiming) filters.deliveryTiming = deliveryTiming;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (search) filters.search = search;
    if (customerId) filters.customerId = customerId;
    if (sort) filters.sort = sort;
    if (page !== undefined) filters.page = Number(page);
    if (limit !== undefined) filters.limit = Number(limit);
    return this.ordersService.getOrders(filters, req.user);
  }

  @Post(':id/reorder')
  @ApiOperation({ summary: 'Build a current-priced cart snapshot from a past order' })
  async reorderOrder(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.reorderOrder(id, req.user);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrderById(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.getOrderById(id, req.user);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry failed order sync' })
  async retryOrder(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.retryOrder(id, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete order' })
  async deleteOrder(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.deleteOrder(id, req.user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update order' })
  async updateOrder(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.ordersService.updateOrder(id, body, req.user);
  }
}

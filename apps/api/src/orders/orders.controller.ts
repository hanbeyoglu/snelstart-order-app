import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
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

  @Get()
  @ApiOperation({ summary: 'Get orders' })
  async getOrders(@Query('status') status: string | undefined, @Req() req: any) {
    const filters: any = {};
    if (status) filters.status = status;
    return this.ordersService.getOrders(filters, req.user);
  }

  @Get(':id')
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

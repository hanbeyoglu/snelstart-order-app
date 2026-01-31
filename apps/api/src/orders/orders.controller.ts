import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
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
  async createOrder(@Body() body: any) {
    return this.ordersService.createOrder(body);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats(@Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    return this.ordersService.getDashboardStats(period);
  }

  @Get()
  @ApiOperation({ summary: 'Get orders' })
  async getOrders(@Query('status') status?: string) {
    const filters: any = {};
    if (status) filters.status = status;
    return this.ordersService.getOrders(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrderById(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry failed order sync' })
  async retryOrder(@Param('id') id: string) {
    return this.ordersService.retryOrder(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete order' })
  async deleteOrder(@Param('id') id: string) {
    return this.ordersService.deleteOrder(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update order' })
  async updateOrder(@Param('id') id: string, @Body() body: any) {
    return this.ordersService.updateOrder(id, body);
  }
}

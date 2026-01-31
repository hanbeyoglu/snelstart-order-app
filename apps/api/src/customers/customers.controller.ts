import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Get customers (optionally filtered by search and cities) with pagination' })
  async getCustomers(
    @Query('search') search?: string,
    @Query('cities') cities?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeAll') includeAll?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const citiesArray = cities ? cities.split(',').filter((c) => c.trim()) : [];
    const includeAllBool = includeAll === 'true';
    return this.customersService.getCustomers(search, citiesArray, pageNum, limitNum, includeAllBool);
  }

  @Get('cities')
  @ApiOperation({ summary: 'Get list of all cities from customers' })
  async getCities() {
    return this.customersService.getCities();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  async getCustomerById(@Param('id') id: string) {
    return this.customersService.getCustomerById(id);
  }

  @Get(':id/with-visit-status')
  @ApiOperation({ summary: 'Get customer with visit status' })
  async getCustomerWithVisitStatus(@Param('id') id: string) {
    return this.customersService.getCustomerWithVisitStatus(id);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: 'Get customer orders from SnelStart' })
  async getCustomerOrders(@Param('id') id: string) {
    return this.customersService.getCustomerOrders(id);
  }

  @Put(':id/visit-status')
  @ApiOperation({ summary: 'Update customer visit status' })
  async updateVisitStatus(
    @Param('id') id: string,
    @Body() body: { status: 'VISITED' | 'PLANNED'; notes?: string },
  ) {
    return this.customersService.updateCustomerVisitStatus(id, body.status, body.notes);
  }

  @Post()
  @ApiOperation({ summary: 'Create new customer in SnelStart' })
  async createCustomer(@Body() body: any) {
    return this.customersService.createCustomer(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update existing customer in SnelStart' })
  async updateCustomer(@Param('id') id: string, @Body() body: any) {
    return this.customersService.updateCustomer(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete customer from SnelStart and local cache' })
  async deleteCustomer(@Param('id') id: string) {
    return this.customersService.deleteCustomer(id);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync customers from SnelStart API' })
  async syncCustomers() {
    try {
      await this.customersService.syncCustomers();
      
      return {
        success: true,
        message: 'Müşteriler başarıyla senkronize edildi',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Senkronizasyon sırasında bir hata oluştu',
      };
    }
  }
}


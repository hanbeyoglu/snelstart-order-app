import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getEffectivePermissions } from '../auth/permissions';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get customers (optionally filtered by search and cities) with pagination',
  })
  async getCustomers(
    @Query('search') search?: string,
    @Query('cities') cities?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeAll') includeAll?: string,
    @Request() req?: any,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const citiesArray = cities ? cities.split(',').filter((c) => c.trim()) : [];
    const permissions = getEffectivePermissions(req.user.role, req.user.permissions);
    if (req.user.role === 'customer') {
      if (!req.user.customerId) {
        throw new ForbiddenException('Customer kullanıcı müşteri kaydına bağlı değil');
      }
      const customer = await this.customersService.getCustomerById(req.user.customerId);
      return {
        data: customer ? [customer] : [],
        pagination: { page: 1, limit: 1, total: customer ? 1 : 0, totalPages: customer ? 1 : 0, hasNextPage: false, hasPrevPage: false },
      };
    }
    const includeAllBool = includeAll === 'true' && permissions.includes('customers.wholesalers.view');
    return this.customersService.getCustomers(
      search,
      citiesArray,
      pageNum,
      limitNum,
      includeAllBool
    );
  }

  @Get('cities')
  @ApiOperation({ summary: 'Get list of all cities from customers' })
  async getCities() {
    return this.customersService.getCities();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  async getCustomerById(@Param('id') id: string, @Request() req: any) {
    this.assertCustomerAccess(req, id);
    return this.customersService.getCustomerById(id);
  }

  @Get(':id/with-visit-status')
  @ApiOperation({ summary: 'Get customer with visit status' })
  async getCustomerWithVisitStatus(@Param('id') id: string, @Request() req: any) {
    this.assertCustomerAccess(req, id);
    return this.customersService.getCustomerWithVisitStatus(id);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: 'Get customer orders from SnelStart' })
  async getCustomerOrders(@Param('id') id: string, @Request() req: any) {
    this.assertCustomerAccess(req, id);
    return this.customersService.getCustomerOrders(id);
  }

  @Put(':id/visit-status')
  @ApiOperation({ summary: 'Update customer visit status' })
  async updateVisitStatus(
    @Param('id') id: string,
    @Body() body: { status: 'VISITED' | 'PLANNED'; notes?: string },
    @Request() req: any,
  ) {
    this.assertNotCustomer(req);
    return this.customersService.updateCustomerVisitStatus(id, body.status, body.notes);
  }

  @Post()
  @ApiOperation({ summary: 'Create new customer in SnelStart' })
  async createCustomer(@Body() body: any, @Request() req: any) {
    this.assertNotCustomer(req);
    return this.customersService.createCustomer(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update existing customer in SnelStart' })
  async updateCustomer(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    this.assertNotCustomer(req);
    return this.customersService.updateCustomer(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete customer from SnelStart and local cache' })
  async deleteCustomer(@Param('id') id: string, @Request() req: any) {
    this.assertNotCustomer(req);
    return this.customersService.deleteCustomer(id);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync customers from SnelStart API' })
  async syncCustomers(@Request() req: any) {
    this.assertNotCustomer(req);
    try {
      await this.customersService.syncCustomers();

      return {
        success: true,
        message: 'Customers synced successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Senkronizasyon sırasında bir hata oluştu',
      };
    }
  }

  private assertCustomerAccess(req: any, customerId: string) {
    if (req?.user?.role !== 'customer') {
      return;
    }
    if (!req.user.customerId || req.user.customerId !== customerId) {
      throw new ForbiddenException('Bu müşteri kaydına erişim yetkiniz yok');
    }
  }

  private assertNotCustomer(req: any) {
    if (req?.user?.role === 'customer') {
      throw new ForbiddenException('Bu işlem müşteri kullanıcıları için kapalı');
    }
  }
}

import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CompanyInfoService } from './company-info.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('company-info')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompanyInfoController {
  constructor(private readonly companyInfoService: CompanyInfoService) {}

  @Get()
  @Roles('admin', 'sales_rep')
  async getCompanyInfo() {
    return this.companyInfoService.getCompanyInfo();
  }

  @Post('refresh')
  @Roles('admin')
  async refreshCompanyInfo() {
    return this.companyInfoService.refreshCompanyInfo();
  }
}

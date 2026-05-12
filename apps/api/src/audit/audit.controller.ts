import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditViewGuard } from '../auth/guards/audit-view.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard, AuditViewGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Roles('sales_rep')
  @ApiOperation({ summary: 'Get audit logs (requires audit.view permission)' })
  async getAuditLogs(
    @Request() req: any,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('critical') critical?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.getLogs({
      action,
      entityType,
      entityId,
      userId,
      startDate,
      endDate,
      critical,
      search,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      currentUserRole: req.user.role,
    });
  }

  @Get('stats')
  @Roles('sales_rep')
  @ApiOperation({ summary: 'Get audit log statistics (requires audit.view permission)' })
  async getAuditStats(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getStats({ startDate, endDate, currentUserRole: req.user.role });
  }
}

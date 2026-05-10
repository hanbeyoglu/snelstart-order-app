import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto, UpdateCurrentUserDto, UpdateUserDto, UpdateUserPermissionsDto } from './dto/user.dto';
import { AuditService } from '../audit/audit.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private usersService: UsersService,
    private auditService: AuditService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user info (available to all authenticated users)' })
  async getCurrentUser(@Request() req: any) {
    return this.usersService.getUserById(req.user.userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile (username, email, firstName, lastName, password)' })
  async updateCurrentUser(
    @Request() req: any,
    @Body() body: UpdateCurrentUserDto,
  ) {
    // Kullanıcı kendi bilgilerini güncelleyebilir, ancak rol değiştiremez
    const updated = await this.usersService.updateUser(req.user.userId, body, false);
    await this.auditService.log({
      action: 'USER_PROFILE_UPDATED',
      entityType: 'User',
      entityId: req.user.userId,
      userId: req.user.userId,
      ...this.auditService.requestContext(req),
      changes: body,
    });
    return updated;
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Get all users' })
  async getAllUsers(
    @Request() req: any,
    @Query('customerId') customerId?: string,
    @Query('role') role?: 'customer' | 'staff',
  ) {
    return this.usersService.getAllUsers(req.user.role, { customerId, role });
  }

  @Get('permissions/catalog')
  @Roles('admin')
  @ApiOperation({ summary: 'Get permissions current user can manage' })
  async getPermissionCatalog(@Request() req: any) {
    return {
      permissions: await this.usersService.getManageablePermissions(req.user.userId, req.user.role),
    };
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@Param('id') id: string, @Request() req: any) {
    return this.usersService.getUserById(id, req.user.role);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create new user' })
  async createUser(@Body() body: CreateUserDto, @Request() req: any) {
    const created = await this.usersService.createUser(
      body.username,
      body.email,
      body.password,
      body.role,
      body.firstName,
      body.lastName,
      req.user.role,
      req.user.userId,
      body.permissions,
      body.customerId,
      body.isActive,
      body.preferredLanguage,
    );
    await this.auditService.log({
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: String((created as any)._id || (created as any).id),
      userId: req.user.userId,
      ...this.auditService.requestContext(req),
      changes: body,
    });
    if (body.role === 'customer') {
      await this.auditService.log({
        action: 'PORTAL_ACCOUNT_CREATED',
        entityType: 'User',
        entityId: String((created as any)._id || (created as any).id),
        userId: req.user.userId,
        ...this.auditService.requestContext(req),
        changes: { customerId: body.customerId },
      });
    }
    return created;
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update user (admin only)' })
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Request() req: any,
  ) {
    // Admin tüm alanları değiştirebilir (rol dahil)
    const before = await this.usersService.getUserById(id, req.user.role);
    const updated = await this.usersService.updateUser(id, body, true, req.user.role);
    const action =
      (before as any).role === 'customer' && body.password
        ? 'PORTAL_ACCOUNT_PASSWORD_RESET'
        : (before as any).role === 'customer' && body.isActive !== undefined
          ? body.isActive === false ? 'PORTAL_ACCOUNT_DISABLED' : 'PORTAL_ACCOUNT_ENABLED'
          : 'USER_UPDATED';
    await this.auditService.log({
      action,
      entityType: 'User',
      entityId: id,
      userId: req.user.userId,
      ...this.auditService.requestContext(req),
      changes: body,
    });
    return updated;
  }

  @Put(':id/permissions')
  @Roles('admin')
  @ApiOperation({ summary: 'Update user permissions' })
  async updateUserPermissions(
    @Param('id') id: string,
    @Body() body: UpdateUserPermissionsDto,
    @Request() req: any,
  ) {
    const result = await this.usersService.updateUserPermissions(id, body.permissions, {
      userId: req.user.userId,
      role: req.user.role,
    });

    await this.auditService.log({
      action: 'USER_PERMISSIONS_UPDATED',
      entityType: 'User',
      entityId: id,
      userId: req.user.userId,
      ...this.auditService.requestContext(req),
      changes: {
        actor: {
          userId: req.user.userId,
          username: req.user.username,
          role: req.user.role,
        },
        target: {
          userId: id,
          username: (result.user as any).username,
          role: (result.user as any).role,
        },
        previousPermissions: result.previousPermissions,
        newPermissions: result.newPermissions,
      },
    });

    return result.user;
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete user' })
  async deleteUser(@Param('id') id: string, @Request() req: any) {
    const before = await this.usersService.getUserById(id, req.user.role);
    const deleted = await this.usersService.deleteUser(id, req.user.role);
    await this.auditService.log({
      action: (before as any).role === 'customer' ? 'PORTAL_ACCOUNT_DELETED' : 'USER_DELETED',
      entityType: 'User',
      entityId: id,
      userId: req.user.userId,
      ...this.auditService.requestContext(req),
    });
    return deleted;
  }
}

import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto, UpdateCurrentUserDto, UpdateUserDto } from './dto/user.dto';
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
      changes: body,
    });
    return updated;
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Get all users' })
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create new user' })
  async createUser(@Body() body: CreateUserDto, @Request() req: any) {
    const created = await this.usersService.createUser(body.username, body.email, body.password, body.role, body.firstName, body.lastName);
    await this.auditService.log({
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: String((created as any)._id || (created as any).id),
      userId: req.user.userId,
      changes: body,
    });
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
    const updated = await this.usersService.updateUser(id, body, true);
    await this.auditService.log({
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      userId: req.user.userId,
      changes: body,
    });
    return updated;
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete user' })
  async deleteUser(@Param('id') id: string, @Request() req: any) {
    const deleted = await this.usersService.deleteUser(id);
    await this.auditService.log({
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: id,
      userId: req.user.userId,
    });
    return deleted;
  }
}

import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user info (available to all authenticated users)' })
  async getCurrentUser(@Request() req: any) {
    return this.usersService.getUserById(req.user.userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile (username, email, firstName, lastName, password)' })
  async updateCurrentUser(
    @Request() req: any,
    @Body() body: { username?: string; email?: string | null; firstName?: string; lastName?: string; password?: string },
  ) {
    // Kullanıcı kendi bilgilerini güncelleyebilir, ancak rol değiştiremez
    return this.usersService.updateUser(req.user.userId, body, false);
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
  async createUser(@Body() body: { username: string; email?: string; firstName?: string; lastName?: string; password: string; role?: 'admin' | 'sales_rep' }) {
    return this.usersService.createUser(body.username, body.email, body.password, body.role, body.firstName, body.lastName);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update user (admin only)' })
  async updateUser(
    @Param('id') id: string,
    @Body() body: { username?: string; email?: string | null; firstName?: string; lastName?: string; password?: string; role?: 'admin' | 'sales_rep' },
  ) {
    // Admin tüm alanları değiştirebilir (rol dahil)
    return this.usersService.updateUser(id, body, true);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete user' })
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}

import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConnectionSettingsService } from '../connection-settings/connection-settings.service';
import { SnelStartService } from '../snelstart/snelstart.service';
import { CategoriesService } from '../categories/categories.service';
import { ProductsService } from '../products/products.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private connectionSettingsService: ConnectionSettingsService,
    private snelStartService: SnelStartService,
    private categoriesService: CategoriesService,
    private productsService: ProductsService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  async login(@Body() body: { email: string; password: string }) {
    // email field'ı artık username veya email olabilir
    try {
      const user = await this.authService.validateUser(body.email, body.password);
      if (!user) {
        throw new UnauthorizedException('Kullanıcı adı veya şifre hatalı');
      }

      // Login olduğunda SnelStart token al
      try {
        const settings = await this.connectionSettingsService.getActiveSettings();
        if (settings && settings.subscriptionKey && settings.integrationKey) {
          // Token al
          const tokenResponse = await this.snelStartService.getToken(settings.integrationKey);
          // Token'ı kaydet
          if (tokenResponse && tokenResponse.access_token && tokenResponse.expires_in) {
            await this.connectionSettingsService.saveAccessToken(
              tokenResponse.access_token,
              tokenResponse.expires_in,
            );
            
            // Token alındıktan sonra kategorileri ve ürünleri senkronize et (arka planda)
            // Login hızını etkilememesi için await kullanmıyoruz
            this.syncDataInBackground().catch((error) => {
              console.error('Background sync error:', error);
            });
          }
        }
      } catch (error) {
        // Token alınamadı - durum pasif kalacak (hata fırlatmıyoruz, login devam eder)
        console.warn('SnelStart token alınamadı:', error);
      }

      return this.authService.login(user);
    } catch (error) {
      // AuthService'den gelen hataları (özellikle max attempts) direkt fırlat
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Diğer hatalar için generic mesaj
      throw new UnauthorizedException('Kullanıcı adı veya şifre hatalı');
    }
  }

  // Arka planda kategorileri ve ürünleri senkronize et
  private async syncDataInBackground(): Promise<void> {
    try {
      console.log('Starting background sync for categories and products...');
      
      // Kategorileri senkronize et
      await this.categoriesService.syncCategories();
      console.log('Categories synced successfully');
      
      // Ürünleri senkronize et
      await this.productsService.syncProducts();
      console.log('Products synced successfully');
      
      console.log('Background sync completed');
    } catch (error) {
      console.error('Background sync failed:', error);
      // Hata olsa bile login devam eder
    }
  }

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  async register(
    @Body() body: { username: string; email: string; password: string; role?: 'admin' | 'sales_rep' },
  ) {
    return this.authService.register(body.username, body.email, body.password, body.role);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  async getCurrentUser(@Request() req: any) {
    return {
      id: req.user.userId,
      username: req.user.username,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      role: req.user.role,
    };
  }
}


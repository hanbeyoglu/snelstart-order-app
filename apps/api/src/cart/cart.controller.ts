import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private cartService: CartService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate cart totals' })
  async calculateCart(
    @Body()
    body: {
      items: Array<{ productId: string; quantity: number }>;
      customerId?: string;
    },
  ) {
    return this.cartService.calculateCart(body.items, body.customerId);
  }
}


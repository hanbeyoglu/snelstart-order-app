import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { PricingService } from '../pricing/pricing.service';
import { CartItem } from '@snelstart-order-app/shared';

@Injectable()
export class CartService {
  constructor(
    private productsService: ProductsService,
    private pricingService: PricingService,
  ) {}

  async calculateCart(items: Array<{ productId: string; quantity: number }>, customerId?: string): Promise<{
    items: CartItem[];
    subtotal: number;
    total: number;
  }> {
    const cartItems: CartItem[] = [];

    for (const item of items) {
      const product: any = await this.productsService.getProductById(item.productId, customerId);
      const basePrice = product.basePrice || 0;
      const finalPrice = customerId ? product.finalPrice : basePrice;
      const vatPercentage = product.btwPercentage || 0;
      const totalPrice = finalPrice * item.quantity;

      cartItems.push({
        productId: product.id,
        productName: product.omschrijving,
        sku: product.artikelnummer,
        quantity: item.quantity,
        unitPrice: finalPrice,
        basePrice,
        totalPrice,
        vatPercentage,
      });
    }

    const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = subtotal; // VAT already included in price

    return { items: cartItems, subtotal, total };
  }
}


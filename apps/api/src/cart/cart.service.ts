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

  private positiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  async calculateCart(items: Array<{ productId: string; quantity: number }>, customerId?: string): Promise<{
    items: CartItem[];
    subtotal: number;
    total: number;
  }> {
    const cartItems: CartItem[] = [];

    for (const item of items.filter((cartItem: any) => cartItem.isChildItem !== true)) {
      const product: any = await this.productsService.getProductById(item.productId, customerId);
      const basePrice = product.basePrice || 0;
      const finalPrice = customerId ? Number(product.finalPrice ?? basePrice) : basePrice;
      const vatPercentage = product.btwPercentage || 0;
      const parentQuantity = this.positiveNumber(item.quantity, 1);
      const totalPrice = finalPrice * parentQuantity;

      cartItems.push({
        productId: product.id,
        productName: product.omschrijving,
        sku: product.artikelnummer,
        categoryId: product.artikelomzetgroepId || product.artikelgroepId || product.artikelOmzetgroep?.id,
        quantity: parentQuantity,
        unitPrice: finalPrice,
        basePrice,
        totalPrice,
        vatPercentage,
        isParentArticle: product.isParentArticle === true,
      });

      for (const subArticle of product.subArticles || []) {
        const child = subArticle.childProduct;
        const quantityPerParent = this.positiveNumber(subArticle.quantityPerParent, 1);
        const childQuantity = parentQuantity * quantityPerParent;
        const childUnitPrice = this.positiveNumber(child?.verkoopprijs, 0);

        cartItems.push({
          productId: `${product.id}::child::${subArticle.childSnelstartId}`,
          productName: child?.omschrijving || 'Alt ürün bulunamadı',
          sku: child?.artikelcode || subArticle.childArtikelcode || subArticle.childSnelstartId,
          quantity: childQuantity,
          unitPrice: childUnitPrice,
          basePrice: childUnitPrice,
          totalPrice: childUnitPrice * childQuantity,
          vatPercentage: 0,
          isChildItem: true,
          lineType: 'recipe_child',
          parentProductId: product.id,
          childSnelstartId: subArticle.childSnelstartId,
          childArtikelcode: subArticle.childArtikelcode,
          quantityPerParent,
          childUri: subArticle.childUri,
          isMissingChild: !child,
          ...(child?.inkoopprijs !== undefined && child.inkoopprijs !== null && { inkoopprijs: child.inkoopprijs }),
          ...(child?.eenheid && { eenheid: child.eenheid }),
          ...(child?.voorraad !== undefined && child.voorraad !== null && { voorraad: child.voorraad }),
        });
      }
    }

    const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = subtotal; // VAT already included in price

    return { items: cartItems, subtotal, total };
  }
}

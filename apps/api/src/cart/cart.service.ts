import { ForbiddenException, Injectable } from '@nestjs/common';
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

  private money(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private getVatRate(source: any): number {
    const parsed = Number(source?.vatRate ?? source?.btwPercentage ?? source?.vatPercentage ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  private calculateTotals(items: CartItem[]) {
    const subtotalExclVat = this.money(items.reduce((sum, item) => sum + item.totalPrice, 0));
    const breakdownByRate = new Map<number, { vatRate: number; subtotalExclVat: number; vatAmount: number; totalInclVat: number }>();

    for (const item of items) {
      const vatRate = this.getVatRate(item);
      const lineSubtotal = this.money(item.totalPrice);
      const vatAmount = this.money((lineSubtotal * vatRate) / 100);
      const lineTotalInclVat = this.money(lineSubtotal + vatAmount);

      item.unitPriceExclVat = this.money(item.unitPrice);
      item.subtotalExclVat = lineSubtotal;
      item.vatAmount = vatAmount;
      item.lineSubtotalExclVat = lineSubtotal;
      item.lineVatAmount = vatAmount;
      item.lineTotalInclVat = lineTotalInclVat;
      item.totalInclVat = lineTotalInclVat;

      const current = breakdownByRate.get(vatRate) || {
        vatRate,
        subtotalExclVat: 0,
        vatAmount: 0,
        totalInclVat: 0,
      };
      current.subtotalExclVat = this.money(current.subtotalExclVat + lineSubtotal);
      current.vatAmount = this.money(current.vatAmount + vatAmount);
      current.totalInclVat = this.money(current.totalInclVat + lineTotalInclVat);
      breakdownByRate.set(vatRate, current);
    }

    const vatAmount = this.money(Array.from(breakdownByRate.values()).reduce((sum, item) => sum + item.vatAmount, 0));
    const totalInclVat = this.money(subtotalExclVat + vatAmount);

    return {
      subtotalExclVat,
      vatAmount,
      vatTotal: vatAmount,
      totalInclVat,
      vatBreakdown: Array.from(breakdownByRate.values()).sort((a, b) => a.vatRate - b.vatRate),
    };
  }

  async calculateCart(items: Array<{ productId: string; quantity: number }>, customerId?: string, user?: any): Promise<{
    items: CartItem[];
    subtotal: number;
    total: number;
    subtotalExclVat: number;
    vatAmount: number;
    vatTotal: number;
    totalInclVat: number;
    vatBreakdown: Array<{ vatRate: number; subtotalExclVat: number; vatAmount: number; totalInclVat: number }>;
  }> {
    if (user?.role === 'customer' && !customerId) {
      throw new ForbiddenException('Customer kullanıcı müşteri kaydına bağlı değil');
    }
    const cartItems: CartItem[] = [];

    for (const item of items.filter((cartItem: any) => cartItem.isChildItem !== true)) {
      const product: any = await this.productsService.getProductById(item.productId, customerId);
      const basePrice = product.basePrice || 0;
      const finalPrice = customerId ? Number(product.finalPrice ?? basePrice) : basePrice;
      const vatRate = this.getVatRate(product);
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
        vatPercentage: vatRate,
        vatType: product.vatType ?? null,
        vatRate,
        vatGroupId: product.vatGroupId,
        vatGroupName: product.vatGroupName,
        isParentArticle: product.isParentArticle === true,
      });

      for (const subArticle of product.subArticles || []) {
        const child = subArticle.childProduct;
        const quantityPerParent = this.positiveNumber(subArticle.quantityPerParent, 1);
        const childQuantity = parentQuantity * quantityPerParent;
        const childUnitPrice = this.positiveNumber(child?.verkoopprijs, 0);
        const childVatRate = this.getVatRate(child);

        cartItems.push({
          productId: `${product.id}::child::${subArticle.childSnelstartId}`,
          productName: child?.omschrijving || 'Alt ürün bulunamadı',
          sku: child?.artikelcode || subArticle.childArtikelcode || subArticle.childSnelstartId,
          quantity: childQuantity,
          unitPrice: childUnitPrice,
          basePrice: childUnitPrice,
          totalPrice: childUnitPrice * childQuantity,
          vatPercentage: childVatRate,
          vatType: child?.vatType ?? null,
          vatRate: childVatRate,
          vatGroupId: child?.vatGroupId,
          vatGroupName: child?.vatGroupName,
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

    const totals = this.calculateTotals(cartItems);

    return {
      items: cartItems,
      subtotal: totals.subtotalExclVat,
      total: totals.totalInclVat,
      ...totals,
    };
  }
}

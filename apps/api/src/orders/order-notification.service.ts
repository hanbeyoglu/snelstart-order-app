import { Injectable, Logger } from '@nestjs/common';
import { MailSettingsService } from '../mail-settings/mail-settings.service';

@Injectable()
export class OrderNotificationService {
  private readonly logger = new Logger(OrderNotificationService.name);

  constructor(private mailSettingsService: MailSettingsService) {}

  async sendOrderCreatedNotification(order: any, user?: any, customer?: any): Promise<boolean> {
    const settings = await this.mailSettingsService.getActiveSettings();

    if (!settings || settings.orderNotificationToEmails.length === 0) {
      return false;
    }

    try {
      await this.mailSettingsService.sendMail(settings, {
        to: settings.orderNotificationToEmails,
        cc: settings.orderNotificationCcEmails.length > 0 ? settings.orderNotificationCcEmails : undefined,
        subject: this.buildSubject(order, customer),
        text: this.buildText(order, user, customer, settings.smtpFromEmail),
      });
      return true;
    } catch (error: any) {
      this.logger.error(`Order notification email failed: ${error?.message || error}`);
      return false;
    }
  }

  private buildSubject(order: any, customer?: any): string {
    const customerName = customer?.naam || customer?.storeName || customer?.companyName || order.customerId;
    const orderId = order.snelstartOrderId || String(order._id || '').slice(-8).toUpperCase();
    return `Yeni Sipariş #${orderId} — ${customerName}`;
  }

  private buildText(order: any, user?: any, customer?: any, fromEmail?: string): string {
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';
    const orderId = order._id?.toString() || '';
    const orderLink = appUrl ? `${appUrl.replace(/\/$/, '')}/orders/${orderId}` : `/orders/${orderId}`;
    const snelstartOrderId = order.snelstartOrderId ? `SnelStart No: ${order.snelstartOrderId}` : '';

    const customerName =
      customer?.naam || customer?.storeName || customer?.companyName || order.customerId || '-';

    const createdBy = this.getCreatedByText(order, user, customer);

    const deliveryType = order.deliveryType || order.leveringswijze || '';
    const deliveryDate = order.deliveryDate || order.leveringsdatum || '';

    const parentItems = (order.items || []).filter((item: any) => !item.isChildItem);

    const itemLines = parentItems
      .map((item: any) => {
        const price = typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2) : '-';
        const vat = typeof item.vatPercentage === 'number' ? `(KDV %${item.vatPercentage})` : '';
        return `  • ${item.productName} [${item.sku || item.productId}] x${item.quantity}  @ €${item.unitPrice?.toFixed(2) ?? '-'}  =  €${price} ${vat}`;
      })
      .join('\n');

    const subtotal = typeof order.subtotalExclVat === 'number' ? order.subtotalExclVat.toFixed(2) : (order.subtotal ?? 0).toFixed(2);
    const vatAmount = typeof order.vatAmount === 'number' ? order.vatAmount.toFixed(2) : '0.00';
    const total = typeof order.totalInclVat === 'number' ? order.totalInclVat.toFixed(2) : (order.total ?? 0).toFixed(2);

    const lines = [
      '═══════════════════════════════════════════',
      '  YENİ SİPARİŞ BİLDİRİMİ',
      '═══════════════════════════════════════════',
      '',
      `Sipariş No   : #${String(orderId).slice(-8).toUpperCase()}`,
    ];

    if (snelstartOrderId) lines.push(`${snelstartOrderId}`);
    lines.push(
      `Tarih        : ${new Date((order as any).createdAt || Date.now()).toLocaleString('tr-TR')}`,
      '',
      '── Müşteri Bilgisi ─────────────────────────',
      `Müşteri      : ${customerName}`,
      `Oluşturan    : ${createdBy}`,
    );

    if (deliveryType) lines.push(`Teslimat     : ${deliveryType}`);
    if (deliveryDate) lines.push(`Teslimat Tar.: ${deliveryDate}`);

    lines.push(
      '',
      '── Ürün Satırları ──────────────────────────',
      itemLines || '  (ürün yok)',
      '',
      '── Tutar Özeti ─────────────────────────────',
      `Ara Tutar    : €${subtotal}  (KDV hariç)`,
      `KDV          : €${vatAmount}`,
      `TOPLAM       : €${total}  (KDV dahil)`,
      '',
      '── Admin Linki ─────────────────────────────',
      orderLink,
      '═══════════════════════════════════════════',
    );

    return lines.join('\n');
  }

  private getCreatedByText(order: any, user?: any, customer?: any): string {
    if (order?.createdByRole === 'customer') {
      const name = order.createdByCustomerName || customer?.naam || order.createdByCustomerId || order.customerId;
      return `Müşteri: ${name}`;
    }
    const fullName =
      order?.createdByFullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    return fullName || order?.createdByUsername || user?.username || '-';
  }
}

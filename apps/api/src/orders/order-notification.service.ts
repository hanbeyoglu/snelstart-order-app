import { Injectable, Logger } from '@nestjs/common';
import { MailSettingsService } from '../mail-settings/mail-settings.service';
import {
  ORDER_NOTIFICATION_EMAIL_STRINGS,
  intlLocaleTagForEmail,
  normalizeOrderNotificationLocale,
  type OrderNotificationEmailLocale,
  type OrderNotificationEmailStrings,
} from '@snelstart-order-app/shared';

function escapeHtml(value: string | undefined | null): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class OrderNotificationService {
  private readonly logger = new Logger(OrderNotificationService.name);

  constructor(private mailSettingsService: MailSettingsService) {}

  private resolveEmailLocale(): OrderNotificationEmailLocale {
    return normalizeOrderNotificationLocale(process.env.ORDER_NOTIFICATION_LOCALE);
  }

  async sendOrderCreatedNotification(order: any, user?: any, customer?: any): Promise<boolean> {
    const settings = await this.mailSettingsService.getActiveSettings();

    if (!settings || settings.orderNotificationToEmails.length === 0) {
      return false;
    }

    const locale = this.resolveEmailLocale();
    const t = ORDER_NOTIFICATION_EMAIL_STRINGS[locale];
    const intlTag = intlLocaleTagForEmail(locale);

    try {
      const subject = this.buildSubject(order, customer, t);
      const text = this.buildText(order, user, customer, t, intlTag);
      const html = this.buildHtml(order, user, customer, t, intlTag);

      await this.mailSettingsService.sendMail(settings, {
        to: settings.orderNotificationToEmails,
        cc: settings.orderNotificationCcEmails.length > 0 ? settings.orderNotificationCcEmails : undefined,
        subject,
        text,
        html,
      });
      return true;
    } catch (error: any) {
      this.logger.error(`Order notification email failed: ${error?.message || error}`);
      return false;
    }
  }

  private orderRef(order: any): string {
    const raw =
      order.orderNumber ||
      order.snelstartOrderId ||
      (order._id ? String(order._id).slice(-8).toUpperCase() : '');
    return raw ? String(raw) : '—';
  }

  private buildSubject(order: any, customer: any | undefined, t: OrderNotificationEmailStrings): string {
    const customerName =
      customer?.naam || customer?.storeName || customer?.companyName || order.customerId || '—';
    return t.subjectTemplate.replace('{orderRef}', this.orderRef(order)).replace('{customerName}', customerName);
  }

  private getCreatedByText(order: any, user?: any, customer?: any): string {
    if (order?.createdByRole === 'customer') {
      const name =
        order.createdByCustomerName || customer?.naam || order.createdByCustomerId || order.customerId;
      return name || '—';
    }
    const fullName =
      order?.createdByFullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    return fullName || order?.createdByUsername || user?.username || '—';
  }

  private formatDate(value: Date | string | undefined, intlTag: string): string {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(intlTag, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  }

  private formatDateOnly(value: Date | string | undefined, intlTag: string): string {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(intlTag, { dateStyle: 'medium' }).format(d);
  }

  private deliveryTypeLabel(order: any, t: OrderNotificationEmailStrings): string {
    const v = order.deliveryType;
    if (v === 'warehouse_pickup') return t.typeWarehouse;
    if (v === 'market_delivery') return t.typeMarket;
    return order.leveringswijze ? String(order.leveringswijze) : '—';
  }

  private deliveryTimingLabel(order: any, t: OrderNotificationEmailStrings, intlTag: string): string {
    const timing = order.deliveryTiming;
    if (timing === 'asap') return t.timingAsap;
    if (timing === 'scheduled') {
      if (order.deliveryDate) {
        return `${t.timingScheduled}: ${this.formatDateOnly(order.deliveryDate, intlTag)}`;
      }
      return t.timingScheduled;
    }
    return '—';
  }

  private deliveryDateLabel(order: any, t: OrderNotificationEmailStrings, intlTag: string): string {
    if (order.deliveryTiming === 'asap') return t.dateAsap;
    if (order.deliveryDate) return this.formatDateOnly(order.deliveryDate, intlTag);
    return '—';
  }

  private customerAddressBlock(customer: any): string {
    if (!customer) return '';
    const parts = [customer.adres, [customer.postcode, customer.plaats].filter(Boolean).join(' ')].filter(
      (p) => p && String(p).trim(),
    );
    return parts.join('\n');
  }

  private buildText(order: any, user: any | undefined, customer: any | undefined, t: OrderNotificationEmailStrings, intlTag: string): string {
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';
    const orderId = order._id?.toString() || '';
    const orderLink = appUrl ? `${appUrl.replace(/\/$/, '')}/orders/${orderId}` : `/orders/${orderId}`;
    const customerName =
      customer?.naam || customer?.storeName || customer?.companyName || order.customerId || '—';
    const createdBy = this.getCreatedByText(order, user, customer);
    const parentItems = (order.items || []).filter((item: any) => !item.isChildItem);
    const itemLines = parentItems
      .map((item: any) => {
        const price = typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2) : '-';
        const vat =
          typeof item.vatPercentage === 'number' ? `(${t.vatWord} %${item.vatPercentage})` : '';
        return `  • ${item.productName} [${item.sku || item.productId}] x${item.quantity}  @ ${t.currency}${item.unitPrice?.toFixed(2) ?? '-'}  =  ${t.currency}${price} ${vat}`;
      })
      .join('\n');

    const subtotal =
      typeof order.subtotalExclVat === 'number' ? order.subtotalExclVat.toFixed(2) : (order.subtotal ?? 0).toFixed(2);
    const vatAmount = typeof order.vatAmount === 'number' ? order.vatAmount.toFixed(2) : '0.00';
    const total = typeof order.totalInclVat === 'number' ? order.totalInclVat.toFixed(2) : (order.total ?? 0).toFixed(2);

    const lines: string[] = [
      '═══════════════════════════════════════════',
      `  ${t.heading}`,
      '═══════════════════════════════════════════',
      '',
      `${t.labelOrderRef}   : #${this.orderRef(order)}`,
    ];
    if (order.snelstartOrderId) lines.push(`${t.labelSnelstart}: ${order.snelstartOrderId}`);
    lines.push(
      `${t.labelDate}        : ${this.formatDate((order as any).createdAt || Date.now(), intlTag)}`,
      '',
      `── ${t.labelCustomer} ─────────────────────────`,
      `${t.labelCustomer}      : ${customerName}`,
      `${t.labelCreatedBy}    : ${createdBy}`,
    );

    if (order.deliveryType || order.deliveryTiming || order.deliveryDate || (order.memo && String(order.memo).trim())) {
      lines.push('', `── ${t.sectionDelivery} ─────────────────────`);
      if (order.deliveryType) lines.push(`${t.labelDeliveryType}: ${this.deliveryTypeLabel(order, t)}`);
      if (order.deliveryTiming) lines.push(`${t.labelDeliveryTiming}: ${this.deliveryTimingLabel(order, t, intlTag)}`);
      if (order.deliveryTiming || order.deliveryDate) {
        lines.push(`${t.labelDeliveryDate}: ${this.deliveryDateLabel(order, t, intlTag)}`);
      }
      if (order.deliveryType === 'market_delivery') {
        const addr = this.customerAddressBlock(customer);
        if (addr) lines.push(`${t.labelDeliveryAddress}:\n${addr.split('\n').map((l) => `  ${l}`).join('\n')}`);
      }
      if (order.memo && String(order.memo).trim()) {
        lines.push(`${t.labelDeliveryNote}: ${String(order.memo).trim()}`);
      }
    }

    lines.push(
      '',
      `── ${t.sectionLines} ──────────────────────────`,
      itemLines || t.noProducts,
      '',
      `── ${t.sectionTotals} ─────────────────────────────`,
      `${t.labelSubtotalExclVat} : ${t.currency}${subtotal}`,
      `${t.labelVat}          : ${t.currency}${vatAmount}`,
      `${t.labelTotalInclVat}    : ${t.currency}${total}`,
      '',
      `── ${t.labelAdminLink} ─────────────────────────────`,
      orderLink,
      '═══════════════════════════════════════════',
    );

    return lines.join('\n');
  }

  private buildHtml(order: any, user: any | undefined, customer: any | undefined, t: OrderNotificationEmailStrings, intlTag: string): string {
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';
    const orderId = order._id?.toString() || '';
    const orderLink = appUrl ? `${appUrl.replace(/\/$/, '')}/orders/${orderId}` : `/orders/${orderId}`;
    const customerName = escapeHtml(
      customer?.naam || customer?.storeName || customer?.companyName || order.customerId || '—',
    );
    const createdBy = escapeHtml(this.getCreatedByText(order, user, customer));
    const parentItems = (order.items || []).filter((item: any) => !item.isChildItem);

    const rows = parentItems
      .map((item: any) => {
        const price = typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2) : '-';
        const vat =
          typeof item.vatPercentage === 'number' ? `${t.vatWord} %${item.vatPercentage}` : '';
        return `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(item.productName)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(String(item.sku || item.productId))}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${item.quantity}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${t.currency}${item.unitPrice?.toFixed(2) ?? '-'}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${t.currency}${price}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;color:#555;">${escapeHtml(vat)}</td></tr>`;
      })
      .join('');

    const subtotal =
      typeof order.subtotalExclVat === 'number' ? order.subtotalExclVat.toFixed(2) : (order.subtotal ?? 0).toFixed(2);
    const vatAmount = typeof order.vatAmount === 'number' ? order.vatAmount.toFixed(2) : '0.00';
    const total = typeof order.totalInclVat === 'number' ? order.totalInclVat.toFixed(2) : (order.total ?? 0).toFixed(2);

    const showDelivery =
      order.deliveryType || order.deliveryTiming || order.deliveryDate || (order.memo && String(order.memo).trim());

    const deliveryRows: string[] = [];
    if (order.deliveryType) {
      deliveryRows.push(
        `<tr><td style="padding:4px 0;color:#555;width:40%;">${escapeHtml(t.labelDeliveryType)}</td><td style="padding:4px 0;">${escapeHtml(this.deliveryTypeLabel(order, t))}</td></tr>`,
      );
    }
    if (order.deliveryTiming) {
      deliveryRows.push(
        `<tr><td style="padding:4px 0;color:#555;">${escapeHtml(t.labelDeliveryTiming)}</td><td style="padding:4px 0;">${escapeHtml(this.deliveryTimingLabel(order, t, intlTag))}</td></tr>`,
      );
    }
    if (order.deliveryTiming || order.deliveryDate) {
      deliveryRows.push(
        `<tr><td style="padding:4px 0;color:#555;">${escapeHtml(t.labelDeliveryDate)}</td><td style="padding:4px 0;">${escapeHtml(this.deliveryDateLabel(order, t, intlTag))}</td></tr>`,
      );
    }
    if (order.deliveryType === 'market_delivery') {
      const addr = this.customerAddressBlock(customer);
      if (addr) {
        deliveryRows.push(
          `<tr><td style="padding:4px 0;color:#555;vertical-align:top;">${escapeHtml(t.labelDeliveryAddress)}</td><td style="padding:4px 0;">${escapeHtml(addr).replace(/\n/g, '<br/>')}</td></tr>`,
        );
      }
    }
    if (order.memo && String(order.memo).trim()) {
      deliveryRows.push(
        `<tr><td style="padding:4px 0;color:#555;vertical-align:top;">${escapeHtml(t.labelDeliveryNote)}</td><td style="padding:4px 0;">${escapeHtml(String(order.memo).trim()).replace(/\n/g, '<br/>')}</td></tr>`,
      );
    }

    const deliveryCard =
      showDelivery && deliveryRows.length > 0
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;margin:16px 0;border:1px solid #e0e0e0;border-radius:8px;background:#fafafa;"><tr><td style="padding:12px 16px;"><div style="font-weight:600;margin-bottom:8px;">${escapeHtml(t.sectionDelivery)}</div><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">${deliveryRows.join('')}</table></td></tr></table>`
        : '';

    const dir = intlTag === 'ar' ? 'rtl' : 'ltr';

    return `<!DOCTYPE html><html lang="${intlTag}"><head><meta charset="utf-8"/><title>${escapeHtml(t.docTitle)}</title></head><body style="margin:0;padding:16px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#222;" dir="${dir}"><div style="max-width:640px;margin:0 auto;"><h1 style="font-size:18px;margin:0 0 12px;">${escapeHtml(t.heading)}</h1><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;"><tr><td style="padding:4px 0;color:#555;width:40%;">${escapeHtml(t.labelOrderRef)}</td><td style="padding:4px 0;"><strong>#${escapeHtml(this.orderRef(order))}</strong></td></tr>${
      order.snelstartOrderId
        ? `<tr><td style="padding:4px 0;color:#555;">${escapeHtml(t.labelSnelstart)}</td><td style="padding:4px 0;">${escapeHtml(String(order.snelstartOrderId))}</td></tr>`
        : ''
    }<tr><td style="padding:4px 0;color:#555;">${escapeHtml(t.labelDate)}</td><td style="padding:4px 0;">${escapeHtml(this.formatDate((order as any).createdAt || Date.now(), intlTag))}</td></tr><tr><td style="padding:4px 0;color:#555;">${escapeHtml(t.labelCustomer)}</td><td style="padding:4px 0;">${customerName}</td></tr><tr><td style="padding:4px 0;color:#555;">${escapeHtml(t.labelCreatedBy)}</td><td style="padding:4px 0;">${createdBy}</td></tr></table>${deliveryCard}<h2 style="font-size:15px;margin:20px 0 8px;">${escapeHtml(t.sectionLines)}</h2><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:collapse;"><thead><tr style="background:#f5f5f5;text-align:left;"><th style="padding:8px;">${escapeHtml(t.thProduct)}</th><th style="padding:8px;">${escapeHtml(t.thSku)}</th><th style="padding:8px;text-align:right;">${escapeHtml(t.thQty)}</th><th style="padding:8px;text-align:right;">${escapeHtml(t.thUnit)}</th><th style="padding:8px;text-align:right;">${escapeHtml(t.thLineTotal)}</th><th style="padding:8px;">${escapeHtml(t.thVat)}</th></tr></thead><tbody>${rows || `<tr><td colspan="6" style="padding:12px;color:#777;">${escapeHtml(t.noProducts)}</td></tr>`}</tbody></table><h2 style="font-size:15px;margin:20px 0 8px;">${escapeHtml(t.sectionTotals)}</h2><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:360px;"><tr><td style="padding:4px 0;">${escapeHtml(t.labelSubtotalExclVat)}</td><td style="padding:4px 0;text-align:right;">${t.currency}${subtotal}</td></tr><tr><td style="padding:4px 0;">${escapeHtml(t.labelVat)}</td><td style="padding:4px 0;text-align:right;">${t.currency}${vatAmount}</td></tr><tr><td style="padding:8px 0 0;font-weight:600;">${escapeHtml(t.labelTotalInclVat)}</td><td style="padding:8px 0 0;text-align:right;font-weight:600;">${t.currency}${total}</td></tr></table><p style="margin-top:24px;"><a href="${escapeHtml(orderLink)}" style="color:#1565c0;">${escapeHtml(t.labelAdminLink)}</a></p></div></body></html>`;
  }
}

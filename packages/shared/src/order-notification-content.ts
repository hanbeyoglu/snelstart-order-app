import {
  ORDER_NOTIFICATION_EMAIL_STRINGS,
  intlLocaleTagForEmail,
  type OrderNotificationEmailLocale,
  type OrderNotificationEmailStrings,
} from './i18n/order-notification-email';
import { buildOrderEmailLogoHtmlBlock, resolveOrderEmailLogoUrl } from './order-email-logo';

function escapeHtml(value: string | undefined | null): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function orderRef(order: any): string {
  const raw =
    order.orderNumber ||
    order.snelstartOrderId ||
    (order._id ? String(order._id).slice(-8).toUpperCase() : '');
  return raw ? String(raw) : '—';
}

function getCreatedByText(order: any, user?: any, customer?: any): string {
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

function formatDate(value: Date | string | undefined, intlTag: string): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(intlTag, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function formatDateOnly(value: Date | string | undefined, intlTag: string): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(intlTag, { dateStyle: 'medium' }).format(d);
}

function deliveryTypeLabel(order: any, t: OrderNotificationEmailStrings): string {
  const v = order.deliveryType;
  if (v === 'warehouse_pickup') return t.typeWarehouse;
  if (v === 'market_delivery') return t.typeMarket;
  return order.leveringswijze ? String(order.leveringswijze) : '—';
}

function deliveryTimingLabel(order: any, t: OrderNotificationEmailStrings, intlTag: string): string {
  const timing = order.deliveryTiming;
  if (timing === 'asap') return t.timingAsap;
  if (timing === 'scheduled') {
    if (order.deliveryDate) {
      return `${t.timingScheduled}: ${formatDateOnly(order.deliveryDate, intlTag)}`;
    }
    return t.timingScheduled;
  }
  return '—';
}

function deliveryDateLabel(order: any, t: OrderNotificationEmailStrings, intlTag: string): string {
  if (order.deliveryTiming === 'asap') return t.dateAsap;
  if (order.deliveryDate) return formatDateOnly(order.deliveryDate, intlTag);
  return '—';
}

function customerAddressBlock(customer: any): string {
  if (!customer) return '';
  const parts = [customer.adres, [customer.postcode, customer.plaats].filter(Boolean).join(' ')].filter(
    (p) => p && String(p).trim(),
  );
  return parts.join('\n');
}

export function buildOrderNotificationSubject(
  order: any,
  customer: any | undefined,
  locale: OrderNotificationEmailLocale,
): string {
  const t = ORDER_NOTIFICATION_EMAIL_STRINGS[locale];
  const customerName =
    customer?.naam || customer?.storeName || customer?.companyName || order.customerId || '—';
  return t.subjectTemplate.replace('{orderRef}', orderRef(order)).replace('{customerName}', customerName);
}

export function buildOrderNotificationText(
  order: any,
  locale: OrderNotificationEmailLocale,
  user?: any,
  customer?: any,
  appUrl = '',
): string {
  const t = ORDER_NOTIFICATION_EMAIL_STRINGS[locale];
  const intlTag = intlLocaleTagForEmail(locale);
  const orderId = order._id?.toString() || '';
  const orderLink = appUrl ? `${appUrl.replace(/\/$/, '')}/orders/${orderId}` : `/orders/${orderId}`;
  const customerName =
    customer?.naam || customer?.storeName || customer?.companyName || order.customerId || '—';
  const createdBy = getCreatedByText(order, user, customer);
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
    `${t.labelOrderRef}   : #${orderRef(order)}`,
  ];
  if (order.snelstartOrderId) lines.push(`${t.labelSnelstart}: ${order.snelstartOrderId}`);
  lines.push(
    `${t.labelDate}        : ${formatDate(order.createdAt || Date.now(), intlTag)}`,
    '',
    `── ${t.labelCustomer} ─────────────────────────`,
    `${t.labelCustomer}      : ${customerName}`,
    `${t.labelCreatedBy}    : ${createdBy}`,
  );

  if (order.deliveryType || order.deliveryTiming || order.deliveryDate) {
    lines.push('', `── ${t.sectionDelivery} ─────────────────────`);
    if (order.deliveryType) lines.push(`${t.labelDeliveryType}: ${deliveryTypeLabel(order, t)}`);
    if (order.deliveryTiming) lines.push(`${t.labelDeliveryTiming}: ${deliveryTimingLabel(order, t, intlTag)}`);
    if (order.deliveryTiming || order.deliveryDate) {
      lines.push(`${t.labelDeliveryDate}: ${deliveryDateLabel(order, t, intlTag)}`);
    }
    if (order.deliveryType === 'market_delivery') {
      const addr = customerAddressBlock(customer);
      if (addr) lines.push(`${t.labelDeliveryAddress}:\n${addr.split('\n').map((l) => `  ${l}`).join('\n')}`);
    }
  }

  if (order.note && String(order.note).trim()) {
    lines.push('', `── ${t.sectionOrderNote} ───────────────────────`);
    lines.push(`${t.labelOrderNote}: ${String(order.note).trim()}`);
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

export function buildOrderNotificationHtml(
  order: any,
  locale: OrderNotificationEmailLocale,
  user?: any,
  customer?: any,
  appUrl = '',
): string {
  const t = ORDER_NOTIFICATION_EMAIL_STRINGS[locale];
  const intlTag = intlLocaleTagForEmail(locale);
  const orderId = order._id?.toString() || '';
  const orderLink = appUrl ? `${appUrl.replace(/\/$/, '')}/orders/${orderId}` : `/orders/${orderId}`;
  const customerName = escapeHtml(
    customer?.naam || customer?.storeName || customer?.companyName || order.customerId || '—',
  );
  const createdBy = escapeHtml(getCreatedByText(order, user, customer));
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

  const showDelivery = order.deliveryType || order.deliveryTiming || order.deliveryDate;
  const orderNoteText = order.note && String(order.note).trim() ? String(order.note).trim() : '';

  const deliveryRows: string[] = [];
  if (order.deliveryType) {
    deliveryRows.push(
      `<tr><td style="padding:4px 0;color:#555;width:40%;">${escapeHtml(t.labelDeliveryType)}</td><td style="padding:4px 0;">${escapeHtml(deliveryTypeLabel(order, t))}</td></tr>`,
    );
  }
  if (order.deliveryTiming) {
    deliveryRows.push(
      `<tr><td style="padding:4px 0;color:#555;">${escapeHtml(t.labelDeliveryTiming)}</td><td style="padding:4px 0;">${escapeHtml(deliveryTimingLabel(order, t, intlTag))}</td></tr>`,
    );
  }
  if (order.deliveryTiming || order.deliveryDate) {
    deliveryRows.push(
      `<tr><td style="padding:4px 0;color:#555;">${escapeHtml(t.labelDeliveryDate)}</td><td style="padding:4px 0;">${escapeHtml(deliveryDateLabel(order, t, intlTag))}</td></tr>`,
    );
  }
  if (order.deliveryType === 'market_delivery') {
    const addr = customerAddressBlock(customer);
    if (addr) {
      deliveryRows.push(
        `<tr><td style="padding:4px 0;color:#555;vertical-align:top;">${escapeHtml(t.labelDeliveryAddress)}</td><td style="padding:4px 0;">${escapeHtml(addr).replace(/\n/g, '<br/>')}</td></tr>`,
      );
    }
  }
  const deliveryCard =
    showDelivery && deliveryRows.length > 0
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;margin:16px 0;border:1px solid #e0e0e0;border-radius:8px;background:#fafafa;"><tr><td style="padding:12px 16px;"><div style="font-weight:600;margin-bottom:8px;">${escapeHtml(t.sectionDelivery)}</div><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">${deliveryRows.join('')}</table></td></tr></table>`
      : '';

  const orderNoteCard = orderNoteText
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;margin:16px 0;border:1px solid #e0e0e0;border-radius:8px;background:#fafafa;"><tr><td style="padding:12px 16px;"><div style="font-weight:600;margin-bottom:8px;">${escapeHtml(t.sectionOrderNote)}</div><div style="white-space:pre-wrap;">${escapeHtml(orderNoteText)}</div></td></tr></table>`
    : '';

  const dir = intlTag === 'ar' ? 'rtl' : 'ltr';
  const logoUrl = resolveOrderEmailLogoUrl(appUrl);
  const logoHeader = logoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto 16px;border-collapse:collapse;">${buildOrderEmailLogoHtmlBlock(logoUrl)}</table>`
    : '';

  return `<!DOCTYPE html><html lang="${intlTag}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(t.docTitle)}</title></head><body style="margin:0;padding:16px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#222;" dir="${dir}"><div style="max-width:640px;margin:0 auto;">${logoHeader}<h1 style="font-size:18px;margin:0 0 12px;">${escapeHtml(t.heading)}</h1><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;"><tr><td style="padding:4px 0;color:#555;width:40%;">${escapeHtml(t.labelOrderRef)}</td><td style="padding:4px 0;"><strong>#${escapeHtml(orderRef(order))}</strong></td></tr>${
    order.snelstartOrderId
      ? `<tr><td style="padding:4px 0;color:#555;">${escapeHtml(t.labelSnelstart)}</td><td style="padding:4px 0;">${escapeHtml(String(order.snelstartOrderId))}</td></tr>`
      : ''
  }<tr><td style="padding:4px 0;color:#555;">${escapeHtml(t.labelDate)}</td><td style="padding:4px 0;">${escapeHtml(formatDate(order.createdAt || Date.now(), intlTag))}</td></tr><tr><td style="padding:4px 0;color:#555;">${escapeHtml(t.labelCustomer)}</td><td style="padding:4px 0;">${customerName}</td></tr><tr><td style="padding:4px 0;color:#555;">${escapeHtml(t.labelCreatedBy)}</td><td style="padding:4px 0;">${createdBy}</td></tr></table>${deliveryCard}${orderNoteCard}<h2 style="font-size:15px;margin:20px 0 8px;">${escapeHtml(t.sectionLines)}</h2><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:collapse;"><thead><tr style="background:#f5f5f5;text-align:left;"><th style="padding:8px;">${escapeHtml(t.thProduct)}</th><th style="padding:8px;">${escapeHtml(t.thSku)}</th><th style="padding:8px;text-align:right;">${escapeHtml(t.thQty)}</th><th style="padding:8px;text-align:right;">${escapeHtml(t.thUnit)}</th><th style="padding:8px;text-align:right;">${escapeHtml(t.thLineTotal)}</th><th style="padding:8px;">${escapeHtml(t.thVat)}</th></tr></thead><tbody>${rows || `<tr><td colspan="6" style="padding:12px;color:#777;">${escapeHtml(t.noProducts)}</td></tr>`}</tbody></table><h2 style="font-size:15px;margin:20px 0 8px;">${escapeHtml(t.sectionTotals)}</h2><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:360px;"><tr><td style="padding:4px 0;">${escapeHtml(t.labelSubtotalExclVat)}</td><td style="padding:4px 0;text-align:right;">${t.currency}${subtotal}</td></tr><tr><td style="padding:4px 0;">${escapeHtml(t.labelVat)}</td><td style="padding:4px 0;text-align:right;">${t.currency}${vatAmount}</td></tr><tr><td style="padding:8px 0 0;font-weight:600;">${escapeHtml(t.labelTotalInclVat)}</td><td style="padding:8px 0 0;text-align:right;font-weight:600;">${t.currency}${total}</td></tr></table><p style="margin-top:24px;"><a href="${escapeHtml(orderLink)}" style="color:#1565c0;">${escapeHtml(t.labelAdminLink)}</a></p></div></body></html>`;
}

import {
  CUSTOMER_ORDER_CONFIRMATION_EMAIL_STRINGS,
  intlLocaleTagForEmail,
  type CustomerOrderConfirmationEmailStrings,
  type CustomerOrderConfirmationLocale,
} from './i18n/customer-order-confirmation-email';
import {
  formatMoney,
  getOrderLineTotals,
  getParentOrderItems,
  resolveCustomerOrderTotals,
  type VatBreakdownRow,
} from './customer-order-confirmation-totals';
import {
  buildOrderEmailLogoHtmlBlock,
  resolveOrderEmailLogoUrl,
  type OrderEmailLogoLogFn,
} from './order-email-logo';

export { resolveOrderEmailLogoUrl as resolveCustomerOrderConfirmationLogoUrl } from './order-email-logo';

function logCustomerOrderEmail(message: string) {
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug(`[customer-order-confirmation] ${message}`);
  }
}

const logoLog: OrderEmailLogoLogFn = (message) => logCustomerOrderEmail(message);

function escapeHtml(value: string | undefined | null): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function orderNumber(order: any): string {
  const raw =
    order.orderNumber ||
    order.snelstartOrderId ||
    (order._id ? String(order._id).slice(-8).toUpperCase() : '');
  return raw ? String(raw) : '—';
}

function customerDisplayName(customer: any, order: any): string {
  return (
    customer?.naam ||
    customer?.storeName ||
    customer?.companyName ||
    customer?.name ||
    order?.createdByCustomerName ||
    '—'
  );
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

function deliveryTypeLabel(order: any, t: CustomerOrderConfirmationEmailStrings): string {
  const v = order.deliveryType;
  if (v === 'warehouse_pickup') return t.typeWarehouse;
  if (v === 'market_delivery') return t.typeMarket;
  return '—';
}

function deliveryTimingLabel(order: any, t: CustomerOrderConfirmationEmailStrings, intlTag: string): string {
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

function deliveryDateLabel(order: any, t: CustomerOrderConfirmationEmailStrings, intlTag: string): string {
  if (order.deliveryTiming === 'asap') return t.dateAsap;
  if (order.deliveryDate) return formatDateOnly(order.deliveryDate, intlTag);
  return '—';
}

function customerAddressBlock(customer: any): string {
  if (!customer) return '';
  const parts = [
    customer.adres || customer.straat,
    [customer.postcode, customer.plaats].filter(Boolean).join(' '),
  ].filter((p) => p && String(p).trim());
  return parts.join('\n');
}

function vatRateLabel(t: CustomerOrderConfirmationEmailStrings, vatRate: number): string {
  return t.vatRateRow.replace('%{rate}', String(vatRate));
}

function buildTextLineRows(parentItems: any[], t: CustomerOrderConfirmationEmailStrings): string {
  return parentItems
    .map((item) => {
      const line = getOrderLineTotals(item);
      return [
        `  • ${item.productName} [${item.sku || item.productId}]`,
        `    ${t.thQty}: ${item.quantity}`,
        `    ${t.thUnitExclVat}: ${t.currency}${formatMoney(line.unitExclVat)}`,
        `    ${t.thLineExclVat}: ${t.currency}${formatMoney(line.lineExclVat)}`,
        `    ${t.thVatPct}: ${line.vatRate}% | ${t.thVatAmount}: ${t.currency}${formatMoney(line.vatAmount)}`,
        `    ${t.thLineInclVat}: ${t.currency}${formatMoney(line.lineInclVat)}`,
      ].join('\n');
    })
    .join('\n\n');
}

function buildTextVatBreakdown(rows: VatBreakdownRow[], t: CustomerOrderConfirmationEmailStrings): string {
  if (!rows.length) return '';
  return rows
    .map((row) => {
      const label = vatRateLabel(t, row.vatRate);
      return `  ${label}: ${t.currency}${formatMoney(row.subtotalExclVat)} + ${t.currency}${formatMoney(row.vatAmount)} = ${t.currency}${formatMoney(row.totalInclVat)}`;
    })
    .join('\n');
}

export function buildCustomerOrderConfirmationSubject(
  order: any,
  locale: CustomerOrderConfirmationLocale,
): string {
  const t = CUSTOMER_ORDER_CONFIRMATION_EMAIL_STRINGS[locale];
  return t.subjectTemplate.replace('{orderNumber}', orderNumber(order));
}

export function buildCustomerOrderConfirmationText(
  order: any,
  locale: CustomerOrderConfirmationLocale,
  customer?: any,
): string {
  const t = CUSTOMER_ORDER_CONFIRMATION_EMAIL_STRINGS[locale];
  const intlTag = intlLocaleTagForEmail(locale);
  const name = customerDisplayName(customer, order);
  const parentItems = getParentOrderItems(order);
  const totals = resolveCustomerOrderTotals(order);
  const itemLines = buildTextLineRows(parentItems, t);
  const breakdownLines = buildTextVatBreakdown(totals.vatBreakdown, t);

  const lines: string[] = [
    t.greeting.replace('{customerName}', name),
    '',
    t.intro,
    '',
    `${t.labelOrderNumber}: ${orderNumber(order)}`,
    `${t.labelOrderDate}: ${formatDate(order.createdAt || Date.now(), intlTag)}`,
  ];

  if (order.deliveryType || order.deliveryTiming || order.deliveryDate) {
    lines.push('', `── ${t.sectionDelivery} ──`);
    if (order.deliveryType) lines.push(`${t.labelDeliveryType}: ${deliveryTypeLabel(order, t)}`);
    if (order.deliveryTiming) lines.push(`${t.labelDeliveryTiming}: ${deliveryTimingLabel(order, t, intlTag)}`);
    lines.push(`${t.labelDeliveryDate}: ${deliveryDateLabel(order, t, intlTag)}`);
    if (order.deliveryType === 'market_delivery') {
      const addr = customerAddressBlock(customer);
      if (addr) lines.push(`${t.labelDeliveryAddress}:\n${addr}`);
    }
  }

  if (order.note && String(order.note).trim()) {
    lines.push('', `${t.sectionOrderNote}:`, String(order.note).trim());
  }

  lines.push(
    '',
    `── ${t.sectionLines} ──`,
    itemLines || t.noProducts,
  );

  if (breakdownLines) {
    lines.push('', `── ${t.sectionVatBreakdown} ──`, breakdownLines);
  }

  lines.push(
    '',
    `── ${t.sectionTotals} ──`,
    `${t.labelSubtotalExclVat}: ${t.currency}${formatMoney(totals.subtotalExclVat)}`,
    `${t.labelVatTotal}: ${t.currency}${formatMoney(totals.vatAmount)}`,
    `${t.labelTotalInclVat}: ${t.currency}${formatMoney(totals.totalInclVat)}`,
    '',
    t.thankYou,
    '',
    t.footer,
  );

  return lines.join('\n');
}

const cellStyle =
  'padding:8px 10px;border-bottom:1px solid #e8e8e8;font-size:13px;color:#333;';
const cellRightStyle = `${cellStyle}text-align:right;`;
const headStyle =
  'padding:10px 8px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.03em;';
const headRightStyle = `${headStyle}text-align:right;`;

export function buildCustomerOrderConfirmationHtml(
  order: any,
  locale: CustomerOrderConfirmationLocale,
  customer?: any,
  appUrl = '',
): string {
  const t = CUSTOMER_ORDER_CONFIRMATION_EMAIL_STRINGS[locale];
  const intlTag = intlLocaleTagForEmail(locale);
  const name = escapeHtml(customerDisplayName(customer, order));
  const logoUrl = resolveOrderEmailLogoUrl(appUrl, logoLog);
  const parentItems = getParentOrderItems(order);
  const totals = resolveCustomerOrderTotals(order);

  const rows = parentItems
    .map((item) => {
      const line = getOrderLineTotals(item);
      return `<tr>
<td style="${cellStyle}">${escapeHtml(item.productName)}</td>
<td style="${cellStyle}color:#666;">${escapeHtml(String(item.sku || item.productId))}</td>
<td style="${cellRightStyle}">${item.quantity}</td>
<td style="${cellRightStyle}">${t.currency}${formatMoney(line.unitExclVat)}</td>
<td style="${cellRightStyle}">${t.currency}${formatMoney(line.lineExclVat)}</td>
<td style="${cellRightStyle}">${line.vatRate}%</td>
<td style="${cellRightStyle}">${t.currency}${formatMoney(line.vatAmount)}</td>
<td style="${cellRightStyle}font-weight:600;">${t.currency}${formatMoney(line.lineInclVat)}</td>
</tr>`;
    })
    .join('');

  const breakdownRows = totals.vatBreakdown
    .map(
      (row) => `<tr>
<td style="${cellStyle}font-weight:600;">${escapeHtml(vatRateLabel(t, row.vatRate))}</td>
<td style="${cellRightStyle}">${t.currency}${formatMoney(row.subtotalExclVat)}</td>
<td style="${cellRightStyle}">${t.currency}${formatMoney(row.vatAmount)}</td>
<td style="${cellRightStyle}font-weight:600;">${t.currency}${formatMoney(row.totalInclVat)}</td>
</tr>`,
    )
    .join('');

  const vatBreakdownCard = breakdownRows
    ? `<h2 style="font-size:16px;font-weight:600;color:#111827;margin:24px 0 12px;">${escapeHtml(t.sectionVatBreakdown)}</h2>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:8px;">
<thead><tr style="background:#f9fafb;">
<th style="${headStyle}">${escapeHtml(t.thBreakdownRate)}</th>
<th style="${headRightStyle}">${escapeHtml(t.thBreakdownSubtotal)}</th>
<th style="${headRightStyle}">${escapeHtml(t.thBreakdownVat)}</th>
<th style="${headRightStyle}">${escapeHtml(t.thBreakdownTotal)}</th>
</tr></thead>
<tbody>${breakdownRows}</tbody>
</table>`
    : '';

  const showDelivery = order.deliveryType || order.deliveryTiming || order.deliveryDate;
  const orderNoteText = order.note && String(order.note).trim() ? String(order.note).trim() : '';

  const deliveryRows: string[] = [];
  if (order.deliveryType) {
    deliveryRows.push(
      `<tr><td style="padding:6px 0;color:#666;width:42%;font-size:14px;">${escapeHtml(t.labelDeliveryType)}</td><td style="padding:6px 0;font-size:14px;color:#222;">${escapeHtml(deliveryTypeLabel(order, t))}</td></tr>`,
    );
  }
  if (order.deliveryTiming) {
    deliveryRows.push(
      `<tr><td style="padding:6px 0;color:#666;font-size:14px;">${escapeHtml(t.labelDeliveryTiming)}</td><td style="padding:6px 0;font-size:14px;color:#222;">${escapeHtml(deliveryTimingLabel(order, t, intlTag))}</td></tr>`,
    );
  }
  if (order.deliveryTiming || order.deliveryDate) {
    deliveryRows.push(
      `<tr><td style="padding:6px 0;color:#666;font-size:14px;">${escapeHtml(t.labelDeliveryDate)}</td><td style="padding:6px 0;font-size:14px;color:#222;">${escapeHtml(deliveryDateLabel(order, t, intlTag))}</td></tr>`,
    );
  }
  if (order.deliveryType === 'market_delivery') {
    const addr = customerAddressBlock(customer);
    if (addr) {
      deliveryRows.push(
        `<tr><td style="padding:6px 0;color:#666;vertical-align:top;font-size:14px;">${escapeHtml(t.labelDeliveryAddress)}</td><td style="padding:6px 0;font-size:14px;color:#222;">${escapeHtml(addr).replace(/\n/g, '<br/>')}</td></tr>`,
      );
    }
  }

  const deliveryCard =
    showDelivery && deliveryRows.length > 0
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:20px 0;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;"><tr><td style="padding:16px 18px;"><div style="font-weight:600;font-size:15px;color:#111827;margin-bottom:10px;">${escapeHtml(t.sectionDelivery)}</div><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${deliveryRows.join('')}</table></td></tr></table>`
      : '';

  const orderNoteCard = orderNoteText
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:16px 0;border:1px solid #e5e7eb;border-radius:10px;background:#fffbeb;"><tr><td style="padding:16px 18px;"><div style="font-weight:600;font-size:15px;color:#92400e;margin-bottom:8px;">${escapeHtml(t.sectionOrderNote)}</div><div style="font-size:14px;color:#78350f;white-space:pre-wrap;line-height:1.5;">${escapeHtml(orderNoteText)}</div></td></tr></table>`
      : '';

  const logoBlock = buildOrderEmailLogoHtmlBlock(logoUrl);
  const dir = intlTag === 'ar' ? 'rtl' : 'ltr';

  return `<!DOCTYPE html>
<html lang="${intlTag}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>${escapeHtml(t.docTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
${logoBlock}
<tr><td style="padding:8px 28px 24px;">
<p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">${escapeHtml(t.greeting.replace('{customerName}', customerDisplayName(customer, order)))}</p>
<p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.5;">${escapeHtml(t.intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:42%;">${escapeHtml(t.labelOrderNumber)}</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">#${escapeHtml(orderNumber(order))}</td></tr>
<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">${escapeHtml(t.labelOrderDate)}</td><td style="padding:6px 0;font-size:14px;color:#111827;">${escapeHtml(formatDate(order.createdAt || Date.now(), intlTag))}</td></tr>
</table>
${deliveryCard}
${orderNoteCard}
<h2 style="font-size:16px;font-weight:600;color:#111827;margin:24px 0 12px;">${escapeHtml(t.sectionLines)}</h2>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
<thead><tr style="background:#f9fafb;">
<th style="${headStyle}">${escapeHtml(t.thProduct)}</th>
<th style="${headStyle}">${escapeHtml(t.thSku)}</th>
<th style="${headRightStyle}">${escapeHtml(t.thQty)}</th>
<th style="${headRightStyle}">${escapeHtml(t.thUnitExclVat)}</th>
<th style="${headRightStyle}">${escapeHtml(t.thLineExclVat)}</th>
<th style="${headRightStyle}">${escapeHtml(t.thVatPct)}</th>
<th style="${headRightStyle}">${escapeHtml(t.thVatAmount)}</th>
<th style="${headRightStyle}">${escapeHtml(t.thLineInclVat)}</th>
</tr></thead>
<tbody>${rows || `<tr><td colspan="8" style="padding:16px;color:#9ca3af;text-align:center;">${escapeHtml(t.noProducts)}</td></tr>`}</tbody>
</table>
${vatBreakdownCard}
<h2 style="font-size:16px;font-weight:600;color:#111827;margin:24px 0 12px;">${escapeHtml(t.sectionTotals)}</h2>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:360px;margin:0 0 0 auto;border-top:2px solid #e5e7eb;">
<tr><td style="padding:8px 0;font-size:14px;color:#4b5563;">${escapeHtml(t.labelSubtotalExclVat)}</td><td style="padding:8px 0;text-align:right;font-size:14px;">${t.currency}${formatMoney(totals.subtotalExclVat)}</td></tr>
<tr><td style="padding:8px 0;font-size:14px;color:#4b5563;">${escapeHtml(t.labelVatTotal)}</td><td style="padding:8px 0;text-align:right;font-size:14px;">${t.currency}${formatMoney(totals.vatAmount)}</td></tr>
<tr><td style="padding:12px 0 0;font-size:16px;font-weight:700;color:#111827;">${escapeHtml(t.labelTotalInclVat)}</td><td style="padding:12px 0 0;text-align:right;font-size:16px;font-weight:700;color:#059669;">${t.currency}${formatMoney(totals.totalInclVat)}</td></tr>
</table>
<p style="margin:28px 0 8px;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(t.thankYou)}</p>
<p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">${escapeHtml(t.footer)}</p>
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">© ${new Date().getFullYear()}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

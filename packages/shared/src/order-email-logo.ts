/** Default absolute CDN logo (used when CUSTOMER_ORDER_EMAIL_LOGO_URL is not set). */
export const ORDER_EMAIL_LOGO_PATH = 'https://cdn.hanbeyoglu.com/DHY-logo.webp';

/** Relative logo path — only combined with a public absolute APP_URL. */
export const ORDER_EMAIL_LOGO_RELATIVE_PATH = '/DHY-logo.jpg';

export const ORDER_EMAIL_LOGO_ALT = 'DHY Food BV';

export type OrderEmailLogoLogFn = (message: string) => void;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Prefer HTTPS for absolute URLs used in email clients (skip localhost upgrade for local dev). */
function toEmailSafeLogoUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol === 'http:' &&
      parsed.hostname !== 'localhost' &&
      parsed.hostname !== '127.0.0.1'
    ) {
      parsed.protocol = 'https:';
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPublicAbsoluteAppBase(base: string): boolean {
  try {
    const parsed = new URL(base.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Public HTTPS logo URL for order emails.
 * Priority: CUSTOMER_ORDER_EMAIL_LOGO_URL → ORDER_EMAIL_LOGO_PATH (CDN) → APP_URL + relative path
 */
export function resolveOrderEmailLogoUrl(appUrl = '', log?: OrderEmailLogoLogFn): string {
  const fromEnv = (process.env.CUSTOMER_ORDER_EMAIL_LOGO_URL || '').trim();
  if (fromEnv) {
    const logoUrl = toEmailSafeLogoUrl(fromEnv);
    log?.(`logoUrl=${logoUrl || '(empty after normalize)'}`);
    return logoUrl;
  }

  if (isAbsoluteHttpUrl(ORDER_EMAIL_LOGO_PATH)) {
    const logoUrl = toEmailSafeLogoUrl(ORDER_EMAIL_LOGO_PATH);
    log?.(`logoUrl=${logoUrl} (ORDER_EMAIL_LOGO_PATH)`);
    return logoUrl;
  }

  const base = (appUrl || process.env.APP_URL || process.env.FRONTEND_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (base && isPublicAbsoluteAppBase(base)) {
    const logoUrl = toEmailSafeLogoUrl(`${base}${ORDER_EMAIL_LOGO_RELATIVE_PATH}`);
    log?.(`logoUrl=${logoUrl} (APP_URL + ${ORDER_EMAIL_LOGO_RELATIVE_PATH})`);
    return logoUrl;
  }

  log?.('logoUrl=(none — set CUSTOMER_ORDER_EMAIL_LOGO_URL or a public APP_URL)');
  return '';
}

/** @deprecated Use resolveOrderEmailLogoUrl */
export const resolveCustomerOrderConfirmationLogoUrl = resolveOrderEmailLogoUrl;

export function buildOrderEmailLogoHtmlBlock(
  logoUrl: string,
  alt: string = ORDER_EMAIL_LOGO_ALT,
): string {
  if (!logoUrl) return '';

  const safeUrl = escapeHtml(logoUrl);
  const safeAlt = escapeHtml(alt);

  return `<tr><td align="center" style="padding:24px 24px 12px;background-color:#ffffff;"><img src="${safeUrl}" width="180" alt="${safeAlt}" style="display:block;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" /></td></tr>`;
}

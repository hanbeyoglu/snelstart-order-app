import {
  normalizeOrderNotificationLocale,
  type OrderNotificationEmailLocale,
} from './i18n/order-notification-email';

export type OrderEmailLocale = OrderNotificationEmailLocale;

export type ResolveOrderEmailLocaleInput = {
  orderLocale?: string | null;
  userPreferredLanguage?: string | null;
  customerPreferredLanguage?: string | null;
  settingsLocale?: string | null;
  envLocale?: string | null;
};

/** Pick email template locale: order snapshot → user → customer → settings → env → default (tr). */
export function resolveOrderEmailLocale(input?: ResolveOrderEmailLocaleInput): OrderEmailLocale {
  if (input?.orderLocale != null && String(input.orderLocale).trim() !== '') {
    return normalizeOrderNotificationLocale(input.orderLocale);
  }
  if (input?.userPreferredLanguage != null && String(input.userPreferredLanguage).trim() !== '') {
    return normalizeOrderNotificationLocale(input.userPreferredLanguage);
  }
  if (
    input?.customerPreferredLanguage != null &&
    String(input.customerPreferredLanguage).trim() !== ''
  ) {
    return normalizeOrderNotificationLocale(input.customerPreferredLanguage);
  }
  if (input?.settingsLocale != null && String(input.settingsLocale).trim() !== '') {
    return normalizeOrderNotificationLocale(input.settingsLocale);
  }
  if (input?.envLocale != null && String(input.envLocale).trim() !== '') {
    return normalizeOrderNotificationLocale(input.envLocale);
  }
  return normalizeOrderNotificationLocale(null);
}

export function resolveOrderEmailLocaleFromOrder(
  order?: { locale?: string | null } | null,
  context?: Omit<ResolveOrderEmailLocaleInput, 'orderLocale'>,
): OrderEmailLocale {
  return resolveOrderEmailLocale({
    orderLocale: order?.locale,
    ...context,
  });
}

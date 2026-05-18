export * from './types';
export * from './validators';
export * from './price-override';
export {
  ORDER_NOTE_MAX_LENGTH,
  SNELSTART_ORDER_NOTE_OMSCHRIJVING,
  buildSnelStartOrderOmschrijving,
  buildSnelStartOrderMemo,
  sanitizeOrderNote,
  type SnelStartMemoOrderInput,
} from './order-note';
export {
  ORDER_NOTIFICATION_EMAIL_LOCALES,
  ORDER_NOTIFICATION_EMAIL_STRINGS,
  intlLocaleTagForEmail,
  normalizeOrderNotificationLocale,
  type OrderNotificationEmailLocale,
  type OrderNotificationEmailStrings,
} from './i18n/order-notification-email';
export {
  resolveOrderEmailLocale,
  resolveOrderEmailLocaleFromOrder,
  type OrderEmailLocale,
  type ResolveOrderEmailLocaleInput,
} from './order-email-locale';
export {
  buildOrderNotificationHtml,
  buildOrderNotificationSubject,
  buildOrderNotificationText,
} from './order-notification-content';
export { resolveCustomerEmails, customerHasValidEmail } from './customer-email';
export {
  CUSTOMER_ORDER_CONFIRMATION_EMAIL_STRINGS,
  intlLocaleTagForEmail as intlLocaleTagForCustomerOrderEmail,
  normalizeOrderNotificationLocale as normalizeCustomerOrderConfirmationLocale,
  type CustomerOrderConfirmationLocale,
  type CustomerOrderConfirmationEmailStrings,
} from './i18n/customer-order-confirmation-email';
export {
  buildCustomerOrderConfirmationHtml,
  buildCustomerOrderConfirmationSubject,
  buildCustomerOrderConfirmationText,
  resolveCustomerOrderConfirmationLogoUrl,
} from './customer-order-confirmation-content';
export {
  ORDER_EMAIL_LOGO_ALT,
  ORDER_EMAIL_LOGO_PATH,
  ORDER_EMAIL_LOGO_RELATIVE_PATH,
  buildOrderEmailLogoHtmlBlock,
  resolveOrderEmailLogoUrl,
} from './order-email-logo';
export {
  SNELSTART_DEFAULT_AUTH_URL,
  SNELSTART_DEFAULT_BASE_URL,
  assertSnelStartCredentials,
  buildSnelStartApiHeaders,
  buildSnelStartRequestDebugInfo,
  createSnelStartVerkooporder,
  fetchSnelStartAccessToken,
  resolveSnelStartCredentialsFromEnv,
  resolveSnelStartUrls,
  sanitizeSyncErrorMessage,
  type SnelStartCredentials,
  type SnelStartTokenResponse,
  type SnelStartUrls,
} from './snelstart-http';

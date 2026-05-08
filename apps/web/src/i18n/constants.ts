export const namespaces = [
  'common',
  'auth',
  'dashboard',
  'products',
  'cart',
  'checkout',
  'settings',
  'categories',
  'customers',
  'users',
  'reports',
  'orders',
  'validation',
  'errors',
  'notifications',
  'legacy',
] as const;

export type Namespace = (typeof namespaces)[number];

export const supportedLanguages = {
  tr: {
    code: 'tr',
    label: 'Türkçe',
    nativeLabel: 'Türkçe',
    locale: 'tr-TR',
    direction: 'ltr',
    currency: 'EUR',
  },
  en: {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    locale: 'en-US',
    direction: 'ltr',
    currency: 'EUR',
  },
  nl: {
    code: 'nl',
    label: 'Nederlands',
    nativeLabel: 'Nederlands',
    locale: 'nl-NL',
    direction: 'ltr',
    currency: 'EUR',
  },
  de: {
    code: 'de',
    label: 'Deutsch',
    nativeLabel: 'Deutsch',
    locale: 'de-DE',
    direction: 'ltr',
    currency: 'EUR',
  },
  ar: {
    code: 'ar',
    label: 'Arabic',
    nativeLabel: 'العربية',
    locale: 'ar',
    direction: 'rtl',
    currency: 'EUR',
  },
} as const;

export type SupportedLanguage = keyof typeof supportedLanguages;

export const defaultLanguage: SupportedLanguage = 'tr';
export const languageStorageKey = 'app-language';

export function isSupportedLanguage(language?: string): language is SupportedLanguage {
  if (!language) return false;
  return language in supportedLanguages;
}

export function normalizeLanguage(language?: string): SupportedLanguage {
  if (!language) return defaultLanguage;
  const baseLanguage = language.split('-')[0];
  return isSupportedLanguage(baseLanguage) ? baseLanguage : defaultLanguage;
}

export function isRtlLanguage(language?: string) {
  return supportedLanguages[normalizeLanguage(language)].direction === 'rtl';
}

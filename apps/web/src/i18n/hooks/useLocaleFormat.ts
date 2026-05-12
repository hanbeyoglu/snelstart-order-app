import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLanguage, supportedLanguages } from '../constants';

type FormatNumberOptions = Intl.NumberFormatOptions;

export function useLocaleFormat() {
  const { i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const config = supportedLanguages[language];

  return useMemo(() => {
    const currencyFormatter = new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.currency,
    });
    const numberFormatter = new Intl.NumberFormat(config.locale);
    const dateFormatter = new Intl.DateTimeFormat(config.locale);
    const dateTimeFormatter = new Intl.DateTimeFormat(config.locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const dateTimeLongFormatter = new Intl.DateTimeFormat(config.locale, {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    return {
      language,
      locale: config.locale,
      direction: config.direction,
      currency: config.currency,
      formatCurrency(value?: number | null) {
        return currencyFormatter.format(Number(value || 0));
      },
      formatNumber(value?: number | null, options?: FormatNumberOptions) {
        if (options) return new Intl.NumberFormat(config.locale, options).format(Number(value || 0));
        return numberFormatter.format(Number(value || 0));
      },
      formatDate(value?: string | Date | null) {
        if (!value) return '';
        return dateFormatter.format(new Date(value));
      },
      formatDateTime(value?: string | Date | null) {
        if (!value) return '';
        return dateTimeFormatter.format(new Date(value));
      },
      formatDateTimeLong(value?: string | Date | null) {
        if (!value) return '';
        return dateTimeLongFormatter.format(new Date(value));
      },
    };
  }, [config.currency, config.direction, config.locale, language]);
}

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { defaultLanguage, languageStorageKey, namespaces, normalizeLanguage } from './constants';
import { resources } from './resources';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: defaultLanguage,
    supportedLngs: Object.keys(resources),
    ns: namespaces,
    defaultNS: 'common',
    fallbackNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: languageStorageKey,
      caches: ['localStorage'],
      convertDetectedLanguage: normalizeLanguage,
    },
    returnNull: false,
  });

export default i18n;

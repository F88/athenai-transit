import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ja from './locales/ja.json';
import en from './locales/en.json';

/**
 * i18next initialization for UI text translation.
 *
 * GTFS data translations (stop names, headsigns, route names) are handled
 * separately via the `TranslatableText` / `dataLang` prop system.
 * This module covers only static UI labels and messages.
 */
void i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: 'ja',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export default i18n;

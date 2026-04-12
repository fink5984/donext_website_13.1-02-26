import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['he', 'en'],

  // Used when no locale matches
  defaultLocale: 'he',
  
  // Always show locale prefix in URL
  localePrefix: 'always',
  
  // Enable locale detection to read from NEXT_LOCALE cookie
  // When user selects a language, it's saved in cookie and remembered
  localeDetection: true
});

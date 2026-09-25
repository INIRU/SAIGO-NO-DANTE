import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ko', 'en', 'ja'],
  defaultLocale: 'en',
  localePrefix: 'always',
  // Page metadata emits hreflang (x-default -> /ko); next-intl's Link header would point x-default at redirecting prefix-less URLs.
  alternateLinks: false,
});

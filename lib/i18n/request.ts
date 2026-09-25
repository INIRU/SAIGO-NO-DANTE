import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import ko from '../../messages/ko.json';
import en from '../../messages/en.json';
import ja from '../../messages/ja.json';

// Static imports: a lazy import() here is async I/O that Cache Components flags in the prerendered <html> shell.
const MESSAGES = { ko, en, ja };

export default getRequestConfig(async ({ requestLocale, locale: explicitLocale }) => {
  // An explicit locale (getMessages({ locale })) must not touch requestLocale, which can read headers.
  const requested = explicitLocale ?? await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: MESSAGES[locale],
  };
});

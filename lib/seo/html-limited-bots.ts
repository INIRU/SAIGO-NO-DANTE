import { HTML_LIMITED_BOT_UA_RE } from 'next/dist/shared/lib/router/utils/html-bots'

/**
 * Crawlers that skip the cached shell and get the whole page rendered at once, with title, canonical and robots in <head>.
 * Next leaves Googlebot out of its own list because it runs scripts, but for a bot Next also never streams metadata into
 * the body: on Vercel Googlebot then gets the shell, and the metadata of pages that resolve it per request (deck, identity,
 * E.G.O and plan details) is only in the script payload. Setting htmlLimitedBots replaces Next's list, so it is kept here.
 * KakaoTalk and Telegram build link previews from <head> only and are not in Next's list either.
 */
export const HTML_LIMITED_BOTS = new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|Googlebot|Daum|kakaotalk-scrap|TelegramBot`, 'i')

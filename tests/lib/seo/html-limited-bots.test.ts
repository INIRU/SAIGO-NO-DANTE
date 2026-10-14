import { describe, expect, it } from 'vitest'
import { HTML_LIMITED_BOTS } from '@/lib/seo/html-limited-bots'

describe('REQ-SHARED-034 crawlers that get metadata in <head>', () => {
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Googlebot-Image/1.0',
    'Mozilla/5.0 (compatible; Daum/5.0; +https://cs.daum.net/faq/15/4118.html)',
    // Next's own list must stay in: setting htmlLimitedBots replaces it.
    'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)',
    'Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Twitterbot/1.0',
    'facebookexternalhit/1.1; kakaotalk-scrap/1.0',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    // Link preview crawlers of the messengers the site is shared on; neither is in Next's list.
    'kakaotalk-scrap/1.0; +https://devtalk.kakao.com/t/scrap/33984',
    'TelegramBot/1.0',
  ])('REQ-SHARED-034 renders the whole page for %s', userAgent => {
    expect(HTML_LIMITED_BOTS.test(userAgent)).toBe(true)
  })

  it.each([
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  ])('REQ-SHARED-034 keeps the cached shell for %s', userAgent => {
    expect(HTML_LIMITED_BOTS.test(userAgent)).toBe(false)
  })
})

export type YoutubeVideo = { videoId: string; title: string; publishedAt: string }

/** YouTube's videos-only uploads feed; the mixed UU feed includes Shorts. */
export function youtubeVideosFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?playlist_id=${channelId.replace(/^UC/, 'UULF')}`
}

export function latestYoutubePreview(xml: string): YoutubeVideo | null {
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    // The official feed marks Shorts in the alternate link, even with identical titles.
    if (/<link\b[^>]*href=["']https:\/\/www\.youtube\.com\/shorts\//.test(entry)) continue
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    const title = entry.match(/<title>([^<]+)<\/title>/)?.[1] ?? ''
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? ''
    if (videoId && /PV|Teaser|인격 소개|\[0{2,3}\]/i.test(title)) return { videoId, title, publishedAt }
  }
  return null
}

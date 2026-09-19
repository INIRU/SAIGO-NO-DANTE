import { describe, expect, it } from 'vitest'
import { latestYoutubePreview, youtubeVideosFeedUrl } from '@/lib/utils/youtube'

describe('latest official YouTube preview', () => {
  it('uses videos-only uploads and excludes a Short with the same title', () => {
    expect(youtubeVideosFeedUrl('UCpqyr6h4RCXCEswHlkSjykA')).toBe('https://www.youtube.com/feeds/videos.xml?playlist_id=UULFpqyr6h4RCXCEswHlkSjykA')
    const entry = (id: string, url: string, title = 'LimbusCompany [000] 오트쿠튀르::수선실 로쟈') => `<entry><yt:videoId>${id}</yt:videoId><title>${title}</title><link rel="alternate" href="${url}"/><published>2026-09-18T09:00:15+00:00</published></entry>`
    const short = entry('avJlUx4CSA8', 'https://www.youtube.com/shorts/avJlUx4CSA8')
    const video = entry('GIe7Fna5LD4', 'https://www.youtube.com/watch?v=GIe7Fna5LD4')
    expect(latestYoutubePreview(short + video)?.videoId).toBe('GIe7Fna5LD4')
    expect(latestYoutubePreview(short)).toBeNull()
    expect(latestYoutubePreview(entry('other', 'https://www.youtube.com/watch?v=other', 'Other news') + video)?.videoId).toBe('GIe7Fna5LD4')
    expect(latestYoutubePreview('<feed/>')).toBeNull()
  })
})

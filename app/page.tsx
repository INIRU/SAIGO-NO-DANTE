import type { Metadata } from 'next'
import { getLatestIdentities } from '@/lib/db/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import HomeClient from './HomeClient'

export const metadata: Metadata = {
  title: '최애의 관리자 | SAIGO NO DANTE',
  description: '림버스 컴퍼니 정보 사이트 — 수감자 인격·EGO DB, 거울 던전 기프트, 키워드 도감, 덱 빌더, 티어표',
  alternates: { canonical: 'https://saigo-no-dante.com' },
}

export type Announcement = {
  id: string
  title: string
  content: string
  pinned: boolean
  created_at: string
}

async function getPinnedAnnouncement(): Promise<Announcement | null> {
  try {
    const supabase = createAdminClient()
    // 핀 고정된 공지 우선
    const { data: pinned } = await supabase
      .schema('limbus')
      .from('announcements')
      .select('id, title, content, pinned, created_at')
      .eq('pinned', true)
      .order('created_at', { ascending: false })
      .limit(1)
    if (pinned?.[0]) return pinned[0]

    // 핀 고정 없으면 최신 공지
    const { data: latest } = await supabase
      .schema('limbus')
      .from('announcements')
      .select('id, title, content, pinned, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
    return latest?.[0] ?? null
  } catch {
    return null
  }
}

// ── Project Moon 공식 채널 ID ────────────────────────────────────────────────
// https://www.youtube.com/@ProjectMoonOfficial 채널 ID를 입력하세요
const PM_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID ?? ''

export type YoutubeVideo = {
  videoId: string
  title: string
  publishedAt: string
}

async function getLatestYoutubeVideo(): Promise<YoutubeVideo | null> {
  if (!PM_CHANNEL_ID) return null
  try {
    // channel_id RSS often returns 404; use uploads playlist (UC→UU) instead
    const playlistId = PM_CHANNEL_ID.replace(/^UC/, 'UU')
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const xml = await res.text()

    // Parse all <entry> blocks and find the latest PV
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => m[1])
    for (const entry of entries) {
      const videoId     = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
      const title       = entry.match(/<title>([^<]+)<\/title>/)?.[1] ?? ''
      const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? ''
      if (videoId && /PV|인격 소개|\[0{2,3}\]/i.test(title)) {
        return { videoId, title, publishedAt }
      }
    }
    return null
  } catch {
    return null
  }
}

export const revalidate = 300  // 5분마다 재검증

export default async function HomePage() {
  const [latestIdentities, latestVideo, pinnedAnnouncement] = await Promise.all([
    getLatestIdentities(6),
    getLatestYoutubeVideo(),
    getPinnedAnnouncement(),
  ])
  return <HomeClient latestIdentities={latestIdentities} latestVideo={latestVideo} pinnedAnnouncement={pinnedAnnouncement} />
}

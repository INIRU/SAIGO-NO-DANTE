import type { Metadata } from 'next'
import { getLatestIdentities } from '@/lib/db/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import HomeClient from './HomeClient'
import HomeStaticSections from '@/components/home/HomeStaticSections'
import JsonLd, { faqJsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: '최애의 관리자 | SAIGO NO DANTE',
  description: '림버스 컴퍼니 정보 사이트 — 수감자 인격·EGO DB, 거울 던전 기프트, 키워드 도감, 덱 빌더, 티어표',
  alternates: { canonical: 'https://saigo-no-dante.com' },
}

const HOME_FAQ = [
  {
    question: '림버스 컴퍼니 리세마라 추천 인격은?',
    answer: '최애의 관리자 티어표 페이지에서 S+/S/A/B/C/F 등급별 추천 인격을 커뮤니티 투표 기반으로 확인할 수 있습니다. 티어표는 주기적으로 업데이트됩니다.',
  },
  {
    question: '림버스 컴퍼니 거울 던전 기프트 조합식은 어디서 볼 수 있나요?',
    answer: '거울 던전 페이지에서 E.G.O 기프트 408종의 키워드별 필터, 등급별 검색, 조합 레시피를 확인할 수 있습니다. 테마팩별 전용 기프트도 확인 가능합니다.',
  },
  {
    question: '림버스 컴퍼니 수감자는 몇 명인가요?',
    answer: '림버스 컴퍼니에는 이상, 파우스트, 돈키호테, 료슈, 뫼르소, 홍루, 히스클리프, 이스마엘, 로쟈, 싱클레어, 오티스, 그레고르 총 12명의 수감자가 있습니다.',
  },
  {
    question: '림버스 컴퍼니 인격 스킬 정보는 어디서 확인하나요?',
    answer: '수감자 페이지에서 각 인격의 스킬 위력, 코인 수, 코인 위력, 공격 타입, 죄악 속성, 패시브 등 상세 정보를 확인할 수 있습니다. 동기화 3/4 단계별 데이터도 제공합니다.',
  },
  {
    question: '림버스 컴퍼니 덱 빌더란?',
    answer: '덱 빌더는 12명의 수감자 인격을 편성하고 활성화되는 E.G.O 기프트를 확인할 수 있는 도구입니다. 만든 덱을 커뮤니티에 공유하고 다른 유저의 덱을 참고할 수도 있습니다.',
  },
]

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
  return (
    <>
      <JsonLd data={faqJsonLd(HOME_FAQ)} />
      <HomeClient latestIdentities={latestIdentities} pinnedAnnouncement={pinnedAnnouncement} />
      <HomeStaticSections latestIdentities={latestIdentities} latestVideo={latestVideo} />
    </>
  )
}

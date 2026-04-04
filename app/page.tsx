import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  Globe, XIcon, Sparkles, ChevronRight, Calendar,
  Shield, Layers, Compass, BookOpen, Trophy, Dices, Shuffle, Map,
} from 'lucide-react'
import { getLatestIdentities } from '@/lib/db/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getIdentityInfoUrl, getSinnerLogoUrl,
  BLUR_PLACEHOLDER,
} from '@/lib/utils/images'
import { RARITY_ICON_MAP } from '@/lib/constants/game'
import JsonLd, { faqJsonLd } from '@/components/seo/JsonLd'
import HeroSection from '@/components/home/HeroSection'
import AnnouncementBanner from '@/components/home/AnnouncementBanner'
import HomeScrollAnimations from '@/components/home/HomeScrollAnimations'
import FeatureCard from '@/components/home/FeatureCard'
import OfficialLinkCard from '@/components/home/OfficialLinkCard'

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
    const { data: pinned } = await supabase
      .schema('limbus')
      .from('announcements')
      .select('id, title, content, pinned, created_at')
      .eq('pinned', true)
      .order('created_at', { ascending: false })
      .limit(1)
    if (pinned?.[0]) return pinned[0]

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

const PM_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID ?? ''

export type YoutubeVideo = {
  videoId: string
  title: string
  publishedAt: string
}

async function getLatestYoutubeVideo(): Promise<YoutubeVideo | null> {
  if (!PM_CHANNEL_ID) return null
  try {
    const playlistId = PM_CHANNEL_ID.replace(/^UC/, 'UU')
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const xml = await res.text()

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

export const revalidate = 300

// ── Static data ──────────────────────────────────────────────────────────────

function YoutubeIcon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  )
}

function DiscordIcon({ size = 18, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

const OFFICIAL_LINKS = [
  { label: '공식 사이트', sub: 'limbuscompany.com',        href: 'https://limbuscompany.com',                     icon: Globe,       color: '#4898b0' },
  { label: 'YouTube',    sub: '공식 채널',                 href: 'https://www.youtube.com/@ProjectMoonOfficial',  icon: YoutubeIcon, color: '#c83030' },
  { label: 'Twitter / X',sub: '@LimbusCompany_B',          href: 'https://x.com/LimbusCompany_B',                 icon: XIcon,       color: '#3870b0' },
  { label: '팬 디스코드', sub: '봇 소개 · 서버 참여',       href: '/bot',                                          icon: DiscordIcon, color: '#5865f2' },
] as const

const FEATURES = [
  { href: '/sinners',            icon: Shield,  tag: 'SINNER DB',        title: '수감자 DB',   desc: '12인 수감자의 인격, EGO, 스킬 데이터를 한 곳에서.',            accent: '#c8900a' },
  { href: '/decks',              icon: Layers,  tag: 'DECK BOARD',       title: '덱 게시판',   desc: '커뮤니티 덱 빌드를 탐색하고 나만의 덱을 등록.',               accent: '#4898b0' },
  { href: '/mirror-dungeon',     icon: Compass, tag: 'MIRROR DUNGEON',   title: '거울 던전',   desc: 'EGO 기프트 도감, 키워드 필터, 조합 레시피.',                  accent: '#8058a8' },
  { href: '/collection',         icon: BookOpen,tag: 'COLLECTION',       title: '보유 현황',   desc: '나의 인격·EGO 체크리스트, URL로 공유.',                        accent: '#d4b830' },
  { href: '/tier-list',          icon: Trophy,  tag: 'TIER LIST',        title: '티어표',      desc: '커뮤니티 투표 기반 리세마라 티어 랭킹.',                       accent: '#d06030' },
  { href: '/extraction',         icon: Dices,   tag: 'EXTRACTION SIM',   title: '추출 시뮬',   desc: '뽑기 확률 시뮬레이션으로 운명을 시험.',                        accent: '#c83030' },
  { href: '/random',             icon: Shuffle, tag: 'RANDOM COMP',      title: '랜덤 편성',   desc: '슬롯머신 UI로 무작위 편성, 키워드 필터.',                      accent: '#3870b0' },
  { href: '/planner',            icon: Map,     tag: 'DUNGEON PLANNER',  title: '거던 플래너', desc: '층별 테마팩 선택, 전략 시뮬레이션.',                           accent: '#8b1a1a' },
] as const

function formatDate(d: string) {
  const dateOnly = d.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return `${year}.${month}.${day}`
  }
  const timestamp = Date.parse(d)
  if (Number.isNaN(timestamp)) return d
  const kst = new Date(timestamp + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')}`
}

export default async function HomePage() {
  const [latestIdentities, latestVideo, pinnedAnnouncement] = await Promise.all([
    getLatestIdentities(6),
    getLatestYoutubeVideo(),
    getPinnedAnnouncement(),
  ])

  const latestDate = latestIdentities[0]?.release_date
  const heroIdentities = latestDate
    ? latestIdentities.filter(id => id.release_date === latestDate)
    : latestIdentities.slice(0, 1)

  return (
    <>
      <JsonLd data={faqJsonLd(HOME_FAQ)} />
      {/* GSAP scroll animation island — renders null, animates server HTML */}
      <HomeScrollAnimations />

      <div style={{ background: 'var(--bg-deep)' }}>

        {/* ── 공지 배너 (interactive: dismiss + expand) ── */}
        {pinnedAnnouncement && (
          <AnnouncementBanner announcement={pinnedAnnouncement} />
        )}

        {/* ── 히어로 (interactive: GSAP slider + slide state) ── */}
        <HeroSection
          heroIdentities={heroIdentities}
          hasPinnedAnnouncement={!!pinnedAnnouncement}
        />

        {/* ── 최신 유튜브 영상 (static server HTML) ── */}
        {latestVideo && (
          <section
            className="relative max-w-5xl mx-auto px-6 py-20"
            style={{ isolation: 'isolate' }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(200,48,30,0.04) 0%, transparent 70%)',
                zIndex: 0,
              }}
            />

            <div className="relative" style={{ zIndex: 1 }}>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <YoutubeIcon size={11} style={{ color: '#c83030' }} />
                    <span className="font-mono" style={{ color: '#c83030', fontSize: '0.625rem', letterSpacing: '0.4em', opacity: 0.8 }}>
                      LATEST VIDEO
                    </span>
                  </div>
                  <h2 className="font-serif text-4xl font-medium tracking-wide" style={{ color: 'var(--gold-light)' }}>
                    최신 영상
                  </h2>
                </div>
                <a
                  href="https://www.youtube.com/@ProjectMoonOfficial/videos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm transition-all hover:gap-2.5 mb-1"
                  style={{ color: '#c83030', opacity: 0.7 }}
                >
                  채널 더보기 <ChevronRight size={14} />
                </a>
              </div>

              <div className="divider-gold mb-8" />

              <div
                style={{
                  position: 'relative',
                  paddingTop: '56.25%',
                  borderRadius: '0.25rem',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  boxShadow: '0 0.5rem 2.5rem rgba(0,0,0,0.6)',
                }}
              >
                <iframe
                  src={`https://www.youtube.com/embed/${latestVideo.videoId}?rel=0&modestbranding=1`}
                  title={latestVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                />
              </div>

              {/* 하단 메타 바 */}
              <div
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mt-4"
                style={{ padding: '0.75rem 0' }}
              >
                <div className="flex items-center gap-2.5 shrink-0">
                  <div
                    className="flex items-center justify-center rounded-full shrink-0"
                    style={{ width: '1.75rem', height: '1.75rem', background: 'rgba(200,48,48,0.12)', border: '1px solid rgba(200,48,48,0.3)' }}
                  >
                    <YoutubeIcon size={13} style={{ color: '#c83030' }} />
                  </div>
                  <span className="font-serif text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Project Moon
                  </span>
                </div>

                <span className="hidden sm:block" style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}>●</span>

                <a
                  href={`https://www.youtube.com/watch?v=${latestVideo.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-serif font-light leading-snug hover:text-yellow-300 transition-colors flex-1 min-w-0 truncate"
                  style={{ color: 'var(--gold-light)', fontSize: '0.9375rem' }}
                >
                  {latestVideo.title}
                </a>

                {latestVideo.publishedAt && (
                  <div className="flex items-center gap-1.5 shrink-0" style={{ color: 'var(--text-muted)' }}>
                    <Calendar size={10} />
                    <span className="font-mono" style={{ fontSize: '0.625rem' }}>
                      {formatDate(latestVideo.publishedAt.slice(0, 10))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── 최신 인격 (static server HTML, GSAP animates in via .latest-card class) ── */}
        {latestIdentities.length > 0 && (
          <section
            className="latest-section relative max-w-7xl mx-auto px-6 py-20"
            style={{ isolation: 'isolate' }}
          >
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(200,144,10,0.04) 0%, transparent 70%)', zIndex: 0 }} />

            <div className="relative" style={{ zIndex: 1 }}>
              <div className="latest-header flex items-end justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={11} style={{ color: 'var(--gold)' }} />
                    <span className="font-mono" style={{ color: 'var(--gold-dim)', fontSize: '0.625rem', letterSpacing: '0.4em' }}>LATEST UPDATE</span>
                  </div>
                  <h2 className="font-serif text-4xl font-medium tracking-wide" style={{ color: 'var(--gold-light)' }}>최신 인격</h2>
                </div>
                {latestDate && (
                  <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-muted)' }}>
                    <Calendar size={11} />
                    <span className="font-mono" style={{ fontSize: '0.6875rem' }}>{formatDate(latestDate)}</span>
                  </div>
                )}
              </div>

              <div className="divider-gold mb-10" />

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {latestIdentities.map((identity) => {
                  const portraitUrl   = getIdentityInfoUrl(identity)
                  const logoUrl       = getSinnerLogoUrl(identity.sinner_id)
                  const rarityIconSrc = RARITY_ICON_MAP[identity.rarity as keyof typeof RARITY_ICON_MAP]
                  return (
                    <Link
                      key={identity.id}
                      href={`/sinners/${identity.sinner_id}/identities/${identity.id}`}
                      className="latest-card group block"
                      style={{ opacity: 0 }}
                    >
                      <div
                        className="relative overflow-hidden"
                        style={{
                          aspectRatio: '3/4',
                          background: 'linear-gradient(160deg, #1e1810 0%, #120e08 100%)',
                          border: '1px solid var(--border)',
                          borderRadius: '0.25rem',
                        }}
                      >
                        {portraitUrl ? (
                          <Image
                            src={portraitUrl}
                            alt={identity.name_kr}
                            fill
                            placeholder="blur"
                            blurDataURL={BLUR_PLACEHOLDER}
                            className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                            style={{ objectPosition: '50% 10%' }}
                            sizes="200px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #1e1810 0%, #0d0a06 100%)' }}>
                            <span className="font-serif font-light" style={{ fontSize: '2.5rem', color: 'rgba(200,144,10,0.08)' }}>
                              {identity.name_kr?.[0] ?? '?'}
                            </span>
                          </div>
                        )}
                        <div className="absolute top-2 left-2 z-10">
                          <Image
                            src={logoUrl}
                            alt=""
                            width={20}
                            height={20}
                            style={{ width: '1.25rem', height: '1.25rem', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))', opacity: 0.75 }}
                          />
                        </div>
                        {rarityIconSrc && (
                          <div className="absolute top-2 right-2 z-10">
                            <Image
                              src={rarityIconSrc}
                              alt={`${identity.rarity}성`}
                              width={48}
                              height={16}
                              unoptimized
                              style={{ height: '0.6875rem', width: 'auto', objectFit: 'contain' }}
                            />
                          </div>
                        )}
                        <div
                          className="absolute bottom-0 left-0 right-0 z-10"
                          style={{ height: '60%', background: 'linear-gradient(to top, rgba(13,11,8,1) 0%, rgba(13,11,8,0.85) 40%, rgba(13,11,8,0.2) 75%, transparent 100%)' }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 z-20">
                          <div
                            className="font-serif font-light leading-tight group-hover:text-yellow-300 transition-colors"
                            style={{ color: 'var(--gold-light)', fontSize: '0.8125rem' }}
                          >
                            {identity.name_kr}
                          </div>
                          <div className="flex items-center gap-1" style={{ marginTop: '0.125rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.5625rem', fontFamily: 'var(--font-title)' }}>
                              {identity.sinner?.name_kr ?? identity.sinner_id}
                            </span>
                            {identity.release_date && (
                              <>
                                <span style={{ color: '#3a2a15', fontSize: '0.375rem' }}>·</span>
                                <span className="font-mono" style={{ color: '#3a2a15', fontSize: '0.5rem' }}>
                                  {formatDate(identity.release_date)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              <div className="mt-12 flex justify-center">
                <Link
                  href="/sinners"
                  className="flex items-center gap-2 font-serif text-sm transition-all hover:border-gold hover:text-gold-light"
                  style={{
                    color: 'var(--gold-dim)',
                    border: '1px solid var(--gold-dim)',
                    padding: '0.5rem 1.5rem',
                    borderRadius: '0.125rem',
                  }}
                >
                  전체 수감자 보기
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── 기능 소개 (client island for accent hover, content server-rendered) ── */}
        <section className="features-section max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-center gap-4 mb-10">
            <div className="divider-gold flex-1" />
            <span className="font-mono shrink-0" style={{ color: '#3a2a15', fontSize: '0.625rem', letterSpacing: '0.4em' }}>
              FEATURES
            </span>
            <div className="divider-gold flex-1" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.href} {...feature} />
            ))}
          </div>
        </section>

        {/* ── 공식 채널 (client island for color hover) ── */}
        <section className="official-section max-w-7xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-4 mb-10">
            <div className="divider-gold flex-1" />
            <span className="font-mono shrink-0" style={{ color: '#3a2a15', fontSize: '0.625rem', letterSpacing: '0.4em' }}>OFFICIAL</span>
            <div className="divider-gold flex-1" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {OFFICIAL_LINKS.map((link) => (
              <OfficialLinkCard key={link.href} {...link} />
            ))}
          </div>

          {/* 마무리 */}
          <div className="mt-14 flex flex-col items-center gap-3">
            <div className="divider-gold" style={{ maxWidth: '12rem' }} />
            <span className="font-logo tracking-widest" style={{ color: 'var(--gold-dim)', fontSize: '1.125rem', opacity: 0.4, letterSpacing: '0.3em' }}>
              SAIGO NO DANTE
            </span>
            <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.5625rem', opacity: 0.3 }}>
              Limbus Company 팬 아카이브
            </span>
          </div>
        </section>

      </div>
    </>
  )
}

import React from 'react'
import Link from 'next/link'
import {
  Globe, XIcon, ExternalLink, Sparkles, ChevronRight, Calendar,
  Shield, Layers, Compass, BookOpen, Trophy, Dices, Shuffle, Map,
} from 'lucide-react'
import type { IdentityWithSinner } from '@/lib/types'
import type { YoutubeVideo } from '@/app/page'
import { getSinnerLogoUrl, getIdentityInfoUrl } from '@/lib/utils/images'
import { RARITY_ICON_MAP } from '@/lib/constants/game'
import { FeatureHoverCard, OfficialHoverCard } from './HomeHoverCard'
import { LatestIdentityCard } from './LatestIdentityCard'

// ── SVG icons (defined here so they work in Server Components) ────────────

function YoutubeIcon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  )
}

function DiscordIcon({ size = 18, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={style}
      aria-hidden="true"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

// ── Static data ───────────────────────────────────────────────────────────

const FEATURES = [
  { href: '/sinners',            Icon: Shield,  tag: 'SINNER DB',        title: '수감자 DB',   desc: '12인 수감자의 인격, EGO, 스킬 데이터를 한 곳에서.', accent: '#c8900a' },
  { href: '/decks',              Icon: Layers,  tag: 'DECK BOARD',       title: '덱 게시판',   desc: '커뮤니티 덱 빌드를 탐색하고 나만의 덱을 등록.',     accent: '#4898b0' },
  { href: '/mirror-dungeon',     Icon: Compass, tag: 'MIRROR DUNGEON',   title: '거울 던전',   desc: 'EGO 기프트 도감, 키워드 필터, 조합 레시피.',        accent: '#8058a8' },
  { href: '/collection',         Icon: BookOpen,tag: 'COLLECTION',       title: '보유 현황',   desc: '나의 인격·EGO 체크리스트, URL로 공유.',             accent: '#d4b830' },
  { href: '/tier-list',          Icon: Trophy,  tag: 'TIER LIST',        title: '티어표',      desc: '커뮤니티 투표 기반 리세마라 티어 랭킹.',             accent: '#d06030' },
  { href: '/extraction',         Icon: Dices,   tag: 'EXTRACTION SIM',   title: '추출 시뮬',  desc: '뽑기 확률 시뮬레이션으로 운명을 시험.',              accent: '#c83030' },
  { href: '/random',             Icon: Shuffle, tag: 'RANDOM COMP',      title: '랜덤 편성',  desc: '슬롯머신 UI로 무작위 편성, 키워드 필터.',            accent: '#3870b0' },
  { href: '/planner',            Icon: Map,     tag: 'DUNGEON PLANNER',  title: '거던 플래너', desc: '층별 테마팩 선택, 전략 시뮬레이션.',                accent: '#8b1a1a' },
] as const

const OFFICIAL_LINKS = [
  { label: '공식 사이트',  sub: 'limbuscompany.com',      href: 'https://limbuscompany.com',                     Icon: Globe,       color: '#4898b0', isInternal: false },
  { label: 'YouTube',     sub: '공식 채널',               href: 'https://www.youtube.com/@ProjectMoonOfficial',  Icon: YoutubeIcon, color: '#c83030', isInternal: false },
  { label: 'Twitter / X', sub: '@LimbusCompany_B',        href: 'https://x.com/LimbusCompany_B',                Icon: XIcon,       color: '#3870b0', isInternal: false },
  { label: '팬 디스코드',  sub: '봇 소개 · 서버 참여',     href: '/bot',                                         Icon: DiscordIcon,  color: '#5865f2', isInternal: true  },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────────────

interface HomeStaticSectionsProps {
  latestIdentities: IdentityWithSinner[]
  latestVideo: YoutubeVideo | null
}

// ── Component ─────────────────────────────────────────────────────────────

export default function HomeStaticSections({ latestIdentities, latestVideo }: HomeStaticSectionsProps) {
  const latestDate = latestIdentities[0]?.release_date

  return (
    <div style={{ background: 'var(--bg-deep)' }}>

      {/* ── 최신 유튜브 영상 ─────────────────────────────────────── */}
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
            {/* 섹션 헤더 */}
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

            {/* 풀 폭 영상 */}
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
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              />
            </div>

            {/* 하단 메타 바 */}
            <div
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mt-4"
              style={{ padding: '0.75rem 0' }}
            >
              {/* 채널 배지 */}
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

              {/* 구분점 (데스크탑) */}
              <span className="hidden sm:block" style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}>●</span>

              {/* 영상 제목 */}
              <a
                href={`https://www.youtube.com/watch?v=${latestVideo.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-serif font-light leading-snug hover:text-yellow-300 transition-colors flex-1 min-w-0 truncate"
                style={{ color: 'var(--gold-light)', fontSize: '0.9375rem' }}
              >
                {latestVideo.title}
              </a>

              {/* 출판일 */}
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

      {/* ── 최신 인격 ──────────────────────────────────────────── */}
      {latestIdentities.length > 0 && (
        <section
          className="latest-section relative max-w-7xl mx-auto px-6 py-20"
          style={{ isolation: 'isolate' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(200,144,10,0.04) 0%, transparent 70%)', zIndex: 0 }}
          />

          <div className="relative" style={{ zIndex: 1 }}>
            <div className="latest-header flex items-end justify-between mb-6" suppressHydrationWarning>
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
                const rarityIconSrc = RARITY_ICON_MAP[identity.rarity]
                return (
                  <LatestIdentityCard
                    key={identity.id}
                    identity={identity}
                    portraitUrl={portraitUrl}
                    logoUrl={logoUrl}
                    rarityIconSrc={rarityIconSrc ?? null}
                  />
                )
              })}
            </div>

            <div className="mt-12 flex justify-center">
              <Link
                href="/sinners"
                className="flex items-center gap-2 font-serif text-sm transition-all hover:text-gold-light"
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

      {/* ── 기능 소개 (카드 그리드) ──────────────────────────── */}
      <section className="features-section max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-center gap-4 mb-10">
          <div className="divider-gold flex-1" />
          <span aria-hidden="true" className="font-mono shrink-0" style={{ color: '#3a2a15', fontSize: '0.625rem', letterSpacing: '0.4em' }}>
            FEATURES
          </span>
          <div className="divider-gold flex-1" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((feature) => (
            <Link key={feature.href} href={feature.href} className="feature-card block" suppressHydrationWarning>
              <FeatureHoverCard
                accent={feature.accent}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.25rem',
                  padding: '1.5rem',
                  minHeight: '10rem',
                  height: '100%',
                  transition: 'border-color 0.25s, box-shadow 0.25s, background 0.25s',
                  position: 'relative',
                }}
              >
                {/* 아이콘 */}
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    background: `${feature.accent}12`,
                    border: `1px solid ${feature.accent}30`,
                    marginBottom: '1rem',
                  }}
                >
                  <feature.Icon
                    size={18}
                    style={{ color: feature.accent, opacity: 0.8 }}
                  />
                </div>

                {/* 태그 */}
                <div
                  className="font-mono"
                  style={{
                    fontSize: '0.5625rem',
                    letterSpacing: '0.3em',
                    color: feature.accent,
                    opacity: 0.5,
                    marginBottom: '0.25rem',
                  }}
                >
                  {feature.tag}
                </div>

                {/* 타이틀 */}
                <div
                  className="font-serif font-light"
                  style={{
                    fontSize: '1.0625rem',
                    color: 'var(--gold)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {feature.title}
                </div>

                {/* 설명 */}
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-body)',
                    lineHeight: 1.5,
                  }}
                >
                  {feature.desc}
                </div>

                {/* 쉐브론 */}
                <ChevronRight
                  aria-hidden="true"
                  size={14}
                  style={{
                    position: 'absolute',
                    bottom: '1rem',
                    right: '1rem',
                    color: '#3a2a15',
                  }}
                />
              </FeatureHoverCard>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 공식 채널 ──────────────────────────────────────────── */}
      <section className="official-section max-w-7xl mx-auto px-6 pb-16">
        <div className="flex items-center gap-4 mb-10">
          <div className="divider-gold flex-1" />
          <span aria-hidden="true" className="font-mono shrink-0" style={{ color: '#3a2a15', fontSize: '0.625rem', letterSpacing: '0.4em' }}>OFFICIAL</span>
          <div className="divider-gold flex-1" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {OFFICIAL_LINKS.map(({ label, sub, href, Icon, color, isInternal }) => {
            const inner = (
              <OfficialHoverCard
                color={color}
                className="flex flex-col items-center text-center h-full"
                style={{
                  background: 'linear-gradient(160deg, #1a1510 0%, #120e08 100%)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.25rem',
                  padding: '1.5rem',
                  minHeight: '9rem',
                  position: 'relative',
                  transition: 'border-color 0.3s, box-shadow 0.3s',
                }}
              >
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    background: `${color}18`,
                    border: `1px solid ${color}40`,
                    marginBottom: '1rem',
                  }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div className="font-serif font-light text-sm mb-1" style={{ color: 'var(--gold-light)' }}>{label}</div>
                <div className="truncate font-mono w-full" style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>{sub}</div>
                <ExternalLink
                  aria-hidden="true"
                  size={12}
                  style={{ position: 'absolute', bottom: '0.75rem', right: '0.75rem', color: '#3a2a15' }}
                />
              </OfficialHoverCard>
            )

            return (
              <div key={href} className="official-link-card" suppressHydrationWarning>
                {isInternal ? (
                  <Link href={href}>{inner}</Link>
                ) : (
                  <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
                )}
              </div>
            )
          })}
        </div>

        {/* 마무리 */}
        <div className="mt-14 flex flex-col items-center gap-3">
          <div className="divider-gold" style={{ maxWidth: '12rem' }} />
          <span aria-hidden="true" className="font-logo tracking-widest" style={{ color: 'var(--gold-dim)', fontSize: '1.125rem', opacity: 0.4, letterSpacing: '0.3em' }}>
            SAIGO NO DANTE
          </span>
          <span aria-hidden="true" className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.5625rem', opacity: 0.3 }}>
            Limbus Company 팬 아카이브
          </span>
        </div>
      </section>

    </div>
  )
}

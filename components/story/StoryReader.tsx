'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ChevronUp } from 'lucide-react'
import { STORAGE_BASE } from '@/lib/constants/game'
import type { EpisodeData, StoryLine } from '@/lib/story/types'

/* ── Color Tag Parser ─────────────────────────── */

const COLOR_TAG_RE = /<color=(#[0-9a-fA-F]{3,8})>([\s\S]*?)<\/color>/g

function parseColorTags(text: string): React.ReactNode {
  const matches = [...text.matchAll(COLOR_TAG_RE)]
  if (matches.length === 0) return text

  const parts: React.ReactNode[] = []
  let lastIndex = 0

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index))
    }
    parts.push(
      <span key={i} style={{ color: m[1] }}>
        {m[2]}
      </span>,
    )
    lastIndex = m.index + m[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

/* ── Speaker Colors (해시 기반 + 캐시) ─────────── */

const speakerColorCache = new Map<string, string>()

function getSpeakerColor(name: string): string {
  const cached = speakerColorCache.get(name)
  if (cached) return cached
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const color = `hsl(${Math.abs(hash) % 360}, 50%, 68%)`
  speakerColorCache.set(name, color)
  return color
}

/* ── Constants ────────────────────────────────── */

const CHAPTER_LABELS: Record<string, string> = {
  prologue: '프롤로그',
  'canto-1': '1장',
  'canto-2': '2장',
  'canto-3': '3장',
  'canto-4': '4장',
  'canto-5': '5장',
  'canto-6': '6장',
  'canto-7': '7장',
  'canto-8': '8장',
}

function getCGUrl(name: string, chapter = 'prologue') {
  return `${STORAGE_BASE}/story/${chapter}/cg/${name}.webp`
}

/* ── Line Grouping ────────────────────────────── */

interface LineGroup {
  type: 'text' | 'cg'
  lines: StoryLine[]
}

/** CG가 연속이면 이미지가 바뀌더라도 하나의 그룹으로 합침 */
function groupLines(lines: StoryLine[]): LineGroup[] {
  const groups: LineGroup[] = []
  let current: LineGroup | null = null

  for (const line of lines) {
    const type = line.activeCGs.length > 0 ? 'cg' : 'text'

    if (!current || current.type !== type) {
      if (current) groups.push(current)
      current = { type, lines: [] }
    }
    current.lines.push(line)
  }
  if (current) groups.push(current)

  return groups
}

/** CG 그룹 내에서 스택 상태별로 서브섹션 분리 */
interface CGSubSection {
  cgStack: string[]
  lines: StoryLine[]
}

function splitCGSections(lines: StoryLine[]): CGSubSection[] {
  const sections: CGSubSection[] = []
  let current: CGSubSection | null = null

  for (const line of lines) {
    const key = line.activeCGs.join(',')
    const currentKey = current?.cgStack.join(',')
    if (!current || key !== currentKey) {
      current = { cgStack: [...line.activeCGs], lines: [] }
      sections.push(current)
    }
    current.lines.push(line)
  }

  return sections
}

/* ── DialogBlock ──────────────────────────────── */

function DialogBlock({
  line,
  isOverCG,
  observerRef,
  showSpeaker = true,
}: {
  line: StoryLine
  isOverCG?: boolean
  observerRef: React.RefObject<IntersectionObserver | null>
  showSpeaker?: boolean
}) {
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) observerRef.current?.observe(node)
    },
    [observerRef],
  )

  if (!line.content) return null

  // <감탄사> 형식만 내면 독백 — <color=...> 태그는 제외
  const stripped = line.content.replace(/<color=[^>]*>|<\/color>/g, '')
  const isInnerThought =
    stripped.startsWith('<') && stripped.endsWith('>')
  const isDante = line.teller === '나'
  const hasShake = line.effect?.type === 'shake'

  return (
    <div
      ref={ref}
      className="story-block mb-[1.75rem]"
      data-shake={hasShake ? '' : undefined}
    >
      {/* Named speaker (not Dante) */}
      {showSpeaker && line.teller && !isDante && (
        <div className="mb-[0.375rem] flex items-baseline gap-[0.5rem]">
          <span
            className="text-[0.9rem] tracking-[0.05em]"
            style={{
              color: getSpeakerColor(line.teller),
              fontFamily: 'Paperlogy, sans-serif',
              fontWeight: 700,
            }}
          >
            {line.teller}
          </span>
          {line.title && line.title !== '???' && (
            <span
              className="text-[0.7rem]"
              style={{
                color: 'var(--gold-dim)',
                fontFamily: 'PerfectDOS, monospace',
                opacity: 0.6,
              }}
            >
              {line.title}
            </span>
          )}
        </div>
      )}

      {/* Dante (censored name) */}
      {showSpeaker && isDante && line.title && (
        <div className="mb-[0.375rem]">
          <span
            className="text-[0.85rem] tracking-[0.1em]"
            style={{
              color: 'var(--gold-dim)',
              fontFamily: 'KotraBold, serif',
            }}
          >
            {line.title}
          </span>
        </div>
      )}

      {/* Dialog content */}
      <p
        className={`text-[1rem] leading-[1.85] ${isInnerThought ? 'italic' : ''}`}
        style={{
          color: isOverCG
            ? 'var(--story-text-bright)'
            : isInnerThought
              ? 'var(--story-text-thought)'
              : 'var(--story-text)',
          fontFamily: 'Paperlogy, sans-serif',
          fontWeight: isInnerThought ? 300 : 400,
          whiteSpace: 'pre-line',
        }}
      >
        {parseColorTags(line.content)}
      </p>
    </div>
  )
}

/* ── PlaceDivider ─────────────────────────────── */

function PlaceDivider({
  place,
  observerRef,
}: {
  place: string
  observerRef: React.RefObject<IntersectionObserver | null>
}) {
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) observerRef.current?.observe(node)
    },
    [observerRef],
  )

  return (
    <div
      ref={ref}
      className="story-block flex items-center gap-[1rem] my-[2.75rem] px-[0.5rem]"
    >
      <div
        className="flex-1 h-px"
        style={{
          background:
            'linear-gradient(to right, transparent, var(--gold-dim), transparent)',
          opacity: 0.25,
        }}
      />
      <span
        className="text-[0.7rem] tracking-[0.25em] uppercase whitespace-nowrap"
        style={{
          color: 'var(--gold-dim)',
          fontFamily: 'PerfectDOS, monospace',
        }}
      >
        {place}
      </span>
      <div
        className="flex-1 h-px"
        style={{
          background:
            'linear-gradient(to left, transparent, var(--gold-dim), transparent)',
          opacity: 0.25,
        }}
      />
    </div>
  )
}

/* ── CGPanel (sticky height:0 + overflow:visible) ── */

function CGPanel({
  group,
  observerRef,
  chapter,
}: {
  group: LineGroup
  chapter: string
  observerRef: React.RefObject<IntersectionObserver | null>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sections = useMemo(() => splitCGSections(group.lines), [group.lines])

  const allCGs = useMemo(() => {
    const set = new Set<string>()
    for (const s of sections) for (const cg of s.cgStack) set.add(cg)
    return [...set]
  }, [sections])

  const allLines = useMemo(
    () => group.lines.filter((l) => l.content),
    [group.lines],
  )

  const [visibleStack, setVisibleStack] = useState<string[]>(
    sections[0]?.cgStack ?? [],
  )
  const [activeLineId, setActiveLineId] = useState<number>(
    allLines[0]?.id ?? -1,
  )
  const cgRef = useRef<HTMLDivElement>(null)
  const [dialogReady, setDialogReady] = useState(false)
  const wasVisible = useRef(false)
  const hasEnteredOnce = useRef(false)
  const resetTimestamp = useRef(0)

  const cgPanelId = useMemo(() => `cg-panel-${allCGs[0] ?? Math.random()}`, [allCGs])

  // Fixed CG를 래퍼 영역에만 표시
  useEffect(() => {
    const onScroll = () => {
      const wrapper = document.querySelector(`[data-cg-panel="${cgPanelId}"]`)
      const wr = wrapper?.getBoundingClientRect()
      const cg = cgRef.current
      if (!wr || !cg) return
      const vh = window.innerHeight
      const top = Math.max(0, wr.top)
      const bottom = Math.min(vh, wr.bottom)
      if (bottom <= top) {
        // 래퍼가 뷰포트에서 충분히 벗어났을 때만 숨김
        cg.style.opacity = '0'
        cg.style.pointerEvents = 'none'
        // CG가 완전히 나가면 다음 진입 시 첫 대사 리셋 준비
        hasEnteredOnce.current = false
        setDialogReady(false)
      } else {
        cg.style.opacity = '1'
        cg.style.pointerEvents = 'none'
        cg.style.top = `${top}px`
        cg.style.height = `${bottom - top}px`
        // CG가 전체화면으로 꽉 찼을 때만 대사 표시
        const isVisible = (bottom - top) > vh * 0.3
        const isFull = top <= 5 && (bottom - top) >= vh * 0.85
        wasVisible.current = isVisible
        if (isFull !== (dialogReady && hasEnteredOnce.current)) {
          setDialogReady(isFull)
          if (isFull && !hasEnteredOnce.current) {
            hasEnteredOnce.current = true
            setActiveLineId(allLines[0]?.id ?? -1)
            setVisibleStack(sections[0]?.cgStack ?? [])
            resetTimestamp.current = Date.now()
          }
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // 스크롤 위치 기반 대사 전환 (observer 대신 — 역스크롤 완벽 지원)
  useEffect(() => {
    const onLineScroll = () => {
      if (!wasVisible.current) return
      if (Date.now() - resetTimestamp.current < 150) return

      const wrapper = document.querySelector(`[data-cg-panel="${cgPanelId}"]`)
      const sentinels = wrapper?.querySelectorAll('[data-cg-line]')
      if (!sentinels?.length) return

      const vh = window.innerHeight
      const center = vh / 2
      let closest: Element | null = null
      let closestDist = Infinity

      for (const el of sentinels) {
        const rect = el.getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        const dist = Math.abs(mid - center)
        if (dist < closestDist) {
          closestDist = dist
          closest = el
        }
      }

      if (closest) {
        const lineId = closest.getAttribute('data-cg-line')
        const stack = closest.getAttribute('data-cg-stack')?.split(',').filter(Boolean) ?? []
        if (lineId) setActiveLineId(parseInt(lineId))
        if (stack.length > 0) setVisibleStack(stack)
      }
    }

    window.addEventListener('scroll', onLineScroll, { passive: true })
    return () => window.removeEventListener('scroll', onLineScroll)
  }, [allLines, cgPanelId])

  const panelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) observerRef.current?.observe(node)
    },
    [observerRef],
  )

  const activeLine = allLines.find((l) => l.id === activeLineId) ?? null

  return (
    <div
      ref={(node) => {
        containerRef.current = node
        panelRef(node)
      }}
      className="my-[2.5rem] -mx-[1rem] sm:-mx-[1.5rem] md:-mx-[3rem]"
      data-cg-panel={cgPanelId}
      style={{ position: 'relative', isolation: 'isolate' }}
    >
      {/* Fixed CG — clip-path로 래퍼 영역에만 표시 */}
      <div
        ref={cgRef}
        className="cg-fullscreen-enter"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '100dvh',
          zIndex: 40,
          overflow: 'hidden',
          pointerEvents: 'none',
          opacity: 0,
        }}
      >
          {allCGs.map((cg, i) => (
            <Image
              key={cg}
              src={getCGUrl(cg, chapter)}
              alt=""
              fill
              className="object-contain"
              sizes="100vw"
              style={{
                zIndex: i,
                opacity: visibleStack.includes(cg)
                  ? (visibleStack[visibleStack.length - 1] === cg ? 1 : 0.3)
                  : 0,
                transition: 'opacity 0.6s ease',
              }}
            />
          ))}

          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 30%, var(--story-bg) 100%)',
              zIndex: allCGs.length,
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: '55%',
              background: 'linear-gradient(to top, var(--story-bg) 0%, transparent 100%)',
              zIndex: allCGs.length + 1,
            }}
          />

          {/* 대사 오버레이 */}
          {dialogReady && activeLine && (
            <div
              className="absolute bottom-[2rem] left-[1.25rem] right-[1.25rem] sm:left-[2rem] sm:right-[2rem]"
              style={{ zIndex: allCGs.length + 10, pointerEvents: 'auto' }}
            >
              <div
                key={activeLine.id}
                className="cg-dialog-fade px-[1.25rem] py-[1rem] rounded-[0.5rem]"
                style={{
                  background: 'color-mix(in srgb, var(--story-bg) 80%, transparent)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid color-mix(in srgb, var(--gold-dim) 10%, transparent)',
                }}
              >
                {activeLine.teller && activeLine.teller !== '나' && (
                  <div className="mb-[0.25rem]">
                    <span
                      className="text-[0.85rem] tracking-[0.05em]"
                      style={{
                        color: getSpeakerColor(activeLine.teller),
                        fontFamily: 'Paperlogy, sans-serif',
                        fontWeight: 700,
                      }}
                    >
                      {activeLine.teller}
                    </span>
                  </div>
                )}
                {activeLine.teller === '나' && activeLine.title && (
                  <div className="mb-[0.25rem]">
                    <span
                      className="text-[0.8rem] tracking-[0.1em]"
                      style={{ color: 'var(--gold-dim)', fontFamily: 'KotraBold, serif' }}
                    >
                      {activeLine.title}
                    </span>
                  </div>
                )}
                <p
                  className="text-[0.95rem] leading-[1.8]"
                  style={{
                    color: 'var(--story-text-bright)',
                    fontFamily: 'Paperlogy, sans-serif',
                    fontWeight: 400,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {parseColorTags(activeLine.content!)}
                </p>
              </div>
            </div>
          )}
      </div>

      {/* 센티넬 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {allLines.map((line) => (
          <div
            key={line.id}
            data-cg-line={line.id}
            data-cg-stack={line.activeCGs.join(',')}
            style={{ height: '16rem' }}
          />
        ))}
      </div>
    </div>
  )
}

/* ── StoryReader (Main) ───────────────────────── */

export default function StoryReader({
  data,
  prevEpisode,
  nextEpisode,
  chapterSlug = 'prologue',
}: {
  data: EpisodeData
  prevEpisode?: string | null
  nextEpisode?: string | null
  chapterSlug?: string
}) {
  const slug = chapterSlug
  const [showTop, setShowTop] = useState(false)
  const showTopRef = useRef(false)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  /* Navbar/Footer 숨기기 + 읽음 표시 */
  useEffect(() => {
    const nav = document.querySelector('nav') as HTMLElement
    const footer = document.querySelector('footer') as HTMLElement
    if (nav) nav.style.display = 'none'
    if (footer) footer.style.display = 'none'
    // 읽음 표시
    try {
      localStorage.setItem(`story-read-${data.episodeId}`, '1')
    } catch {}
    return () => {
      if (nav) nav.style.display = ''
      if (footer) footer.style.display = ''
    }
  }, [data.episodeId])

  /* IntersectionObserver — fade-in + shake trigger */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view')
            if (entry.target.hasAttribute('data-shake')) {
              // 클래스 제거 후 재추가로 애니메이션 재실행 보장
              setTimeout(() => {
                entry.target.classList.remove('story-shake')
                // reflow 강제 → 애니메이션 재시작
                void (entry.target as HTMLElement).offsetWidth
                entry.target.classList.add('story-shake')
              }, 550) // fade-in(0.55s) 완료 후 실행
            }
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    observerRef.current = observer

    // ref 콜백이 observer 생성 전에 실행된 요소들 보완
    document.querySelectorAll('.story-block:not(.in-view)').forEach((el) => {
      observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  /* Scroll progress — ref 기반 DOM 직접 업데이트 (re-render 방지) */
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight
      if (progressBarRef.current) {
        const pct = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) * 100 : 0
        progressBarRef.current.style.width = `${pct}%`
      }
      const shouldShow = scrollTop > 500
      if (shouldShow !== showTopRef.current) {
        showTopRef.current = shouldShow
        setShowTop(shouldShow)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const groups = useMemo(() => groupLines(data.lines), [data.lines])

  // 장소 변경 지점 미리 계산 (render 중 mutable 변수 방지)
  const placeChanges = useMemo(() => {
    const changes = new Set<number>()
    let last: string | null = null
    for (const line of data.lines) {
      if (line.place && line.place !== last) {
        changes.add(line.id)
        last = line.place
      }
    }
    return changes
  }, [data.lines])

  return (
    <div className="story-viewer min-h-screen" style={{ background: 'var(--story-bg)' }}>
      {/* ── Progress bar ── */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-50">
        <div
          ref={progressBarRef}
          className="h-full story-progress-bar"
          style={{
            width: '0%',
            background: 'linear-gradient(to right, var(--gold-dim), var(--gold))',
            transition: 'width 120ms ease-out',
          }}
        />
      </div>

      {/* ── Sticky header ── */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{
          background: 'color-mix(in srgb, var(--story-bg) 90%, transparent)',
          borderBottom: '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
        }}
      >
        <div className="max-w-[42rem] mx-auto px-[1.25rem] py-[0.75rem] flex items-center justify-between">
          <Link
            href={`/story/${slug}`}
            className="flex items-center gap-[0.5rem] transition-opacity hover:opacity-70"
            style={{ color: 'var(--gold-dim)' }}
          >
            <ArrowLeft style={{ width: '0.9rem', height: '0.9rem' }} />
            <span
              className="text-[0.8rem]"
              style={{ fontFamily: 'Paperlogy, sans-serif' }}
            >
              {CHAPTER_LABELS[slug] ?? slug}
            </span>
          </Link>
          <span
            className="text-[0.6rem] tracking-[0.15em] opacity-40"
            style={{
              color: 'var(--gold-dim)',
              fontFamily: 'PerfectDOS, monospace',
            }}
          >
            {data.episodeId}
          </span>
        </div>
      </header>

      {/* ── Story content ── */}
      <main className="max-w-[42rem] mx-auto px-[1.5rem] sm:px-[2rem] pt-[3rem] pb-[4rem]">
        {groups.map((group, gi) => {
          const elements: React.ReactNode[] = []

          /* CG group */
          if (group.type === 'cg') {
            elements.push(
              <CGPanel
                key={`cg-${gi}`}
                group={group}
                chapter={slug}
                observerRef={observerRef}
              />,
            )
          } else {
            /* Text group — 디바이더와 대사를 인터리브로 렌더링 */
            const textLines = group.lines.filter((l) => l.content)
            let prevTeller: string | null = null
            for (const line of textLines) {
              if (line.place && placeChanges.has(line.id)) {
                elements.push(
                  <PlaceDivider
                    key={`place-${line.id}`}
                    place={line.place}
                    observerRef={observerRef}
                  />,
                )
                prevTeller = null
              }
              elements.push(
                <DialogBlock
                  key={`line-${line.id}`}
                  line={line}
                  observerRef={observerRef}
                  showSpeaker={prevTeller !== line.teller}
                />,
              )
              prevTeller = line.teller
            }
          }

          return <div key={gi}>{elements}</div>
        })}

        {/* ── Episode navigation (CG 위에 표시되도록 z-index) ── */}
        <nav
          className="mt-[4rem] pt-[2rem] flex justify-between items-center"
          style={{
            borderTop:
              '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
            position: 'relative',
            zIndex: 50,
            background: 'var(--story-bg)',
          }}
        >
          {prevEpisode ? (
            <Link
              href={`/story/${slug}/${prevEpisode}`}
              className="text-[0.85rem] transition-opacity hover:opacity-70"
              style={{
                color: 'var(--gold-dim)',
                fontFamily: 'Paperlogy, sans-serif',
              }}
            >
              ← 이전
            </Link>
          ) : (
            <div />
          )}
          <Link
            href={`/story/${slug}`}
            className="text-[0.7rem] tracking-[0.1em] transition-opacity hover:opacity-70"
            style={{
              color: 'var(--gold-dim)',
              fontFamily: 'PerfectDOS, monospace',
              opacity: 0.5,
            }}
          >
            목록
          </Link>
          {nextEpisode ? (
            <Link
              href={`/story/${slug}/${nextEpisode}`}
              className="text-[0.85rem] transition-opacity hover:opacity-70"
              style={{
                color: 'var(--gold-dim)',
                fontFamily: 'Paperlogy, sans-serif',
              }}
            >
              다음 →
            </Link>
          ) : (
            <div />
          )}
        </nav>
      </main>

      {/* ── Scroll to top ── */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-[1.5rem] right-[1.5rem] w-[2.5rem] h-[2.5rem] rounded-full flex items-center justify-center z-40 transition-all duration-300 ${
          showTop
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-[0.5rem] pointer-events-none'
        }`}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--gold-dim)',
        }}
        aria-label="맨 위로"
      >
        <ChevronUp style={{ width: '1rem', height: '1rem' }} />
      </button>
    </div>
  )
}

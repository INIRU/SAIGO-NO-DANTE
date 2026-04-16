'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/lib/i18n/navigation'
import { Check } from 'lucide-react'
import type { EpisodeSummary } from '@/lib/story/types'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export default function EpisodeList({
  episodes,
  chapterSlug = 'prologue',
}: {
  episodes: EpisodeSummary[]
  chapterSlug?: string
}) {
  const [readSet, setReadSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    const read = new Set<string>()
    for (const ep of episodes) {
      if (localStorage.getItem(`story-read-${ep.storyId}`)) {
        read.add(ep.storyId)
      }
    }
    setReadSet(read)
  }, [episodes])

  return (
    <div className="space-y-[0.625rem]">
      {episodes.map((ep, i) => {
        const isRead = readSet.has(ep.storyId)

        return (
          <Link
            key={ep.storyId}
            href={`/story/${chapterSlug}/${ep.storyId}`}
            className="episode-card block rounded-[0.25rem]"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              padding: '1.125rem 1.25rem',
            }}
          >
            <div className="flex items-start justify-between gap-[1rem]">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-[0.75rem] mb-[0.25rem]">
                  {/* Roman numeral */}
                  <span
                    className="text-[0.65rem] tracking-[0.12em] shrink-0"
                    style={{
                      fontFamily: 'var(--font-perfect-dos), monospace',
                      color: 'var(--gold-dim)',
                      opacity: 0.6,
                      minWidth: '1.25rem',
                    }}
                  >
                    {ROMAN[i] ?? String(i + 1)}
                  </span>

                  {/* Place name */}
                  <span
                    className="text-[0.95rem]"
                    style={{
                      fontFamily: 'var(--font-paperlogy), sans-serif',
                      fontWeight: 700,
                      color: '#ddd5c8',
                    }}
                  >
                    {isRead ? (ep.nodeTitle || ep.firstPlace || '-') : '???'}
                  </span>

                  {/* Before/After badge */}
                  {isRead && (
                    <span
                      className="text-[0.55rem] px-[0.375rem] py-[0.125rem] rounded-[0.125rem] shrink-0"
                      style={{
                        fontFamily: 'var(--font-perfect-dos), monospace',
                        color:
                          ep.stageDetail === 'Before'
                            ? 'var(--gold-dim)'
                            : 'var(--crimson)',
                        background:
                          ep.stageDetail === 'Before'
                            ? 'color-mix(in srgb, var(--gold-dim) 12%, transparent)'
                            : 'color-mix(in srgb, var(--crimson) 12%, transparent)',
                      }}
                    >
                      {ep.stageDetail === 'Before' ? '전투 전' : '전투 후'}
                    </span>
                  )}

                  {/* Read indicator */}
                  {isRead && (
                    <Check
                      style={{
                        width: '0.75rem',
                        height: '0.75rem',
                        color: 'var(--gold-dim)',
                        opacity: 0.5,
                      }}
                    />
                  )}
                </div>

                {/* Preview line */}
                {isRead && ep.firstLine && (
                  <p
                    className="text-[0.8rem] truncate mt-[0.25rem]"
                    style={{
                      color: isRead ? '#706858' : '#9a8a78',
                      fontFamily: 'var(--font-paperlogy), sans-serif',
                      fontWeight: 300,
                    }}
                  >
                    {ep.firstLine}
                  </p>
                )}
              </div>

              {/* Line count */}
              <span
                className="text-[0.6rem] mt-[0.25rem] shrink-0"
                style={{
                  fontFamily: 'var(--font-perfect-dos), monospace',
                  color: 'var(--gold-dim)',
                  opacity: 0.3,
                }}
              >
                {ep.lineCount}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

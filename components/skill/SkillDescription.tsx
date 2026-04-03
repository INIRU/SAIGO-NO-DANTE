'use client'

import Image from 'next/image'
import { STORAGE_BASE } from '@/lib/constants/game'
import { useFormatSkillDesc } from '@/components/providers/KeywordProvider'
import CoinBadge from './CoinBadge'
import { SKILL_DESC_STYLES, type SkillDescVariant } from './tokens'

interface CoinSection {
  coinNum: number
  isUnbreakable: boolean
  lines: string[]
}

function parseDescription(description: string) {
  const lines = description.split('\n')
  const globalEffects: string[] = []
  const paragraphBreaks = new Set<number>()
  const coinSections: CoinSection[] = []
  let currentCoin: CoinSection | null = null
  let sawEmptyLine = false

  for (const line of lines) {
    const coinMatch = line.match(/^\[코인\s?(\d+)\]\s*(.*)/)
    if (coinMatch) {
      currentCoin = { coinNum: parseInt(coinMatch[1]), isUnbreakable: false, lines: [] }
      coinSections.push(currentCoin)
      sawEmptyLine = false
      const content = coinMatch[2].trim()
      if (content === '파괴 불가 코인' || content.startsWith('파괴 불가 코인')) {
        currentCoin.isUnbreakable = true
        const rest = content.replace(/^파괴 불가 코인\s*/, '').trim()
        if (rest) currentCoin.lines.push(rest)
      } else if (content) {
        currentCoin.lines.push(content)
      }
    } else if (currentCoin && line.trim()) {
      // 같은 코인의 후속 줄
      currentCoin.lines.push(line.trim())
    } else if (line.trim()) {
      if (sawEmptyLine && globalEffects.length > 0) {
        paragraphBreaks.add(globalEffects.length)
      }
      globalEffects.push(line.trim())
      sawEmptyLine = false
    } else if (!currentCoin) {
      sawEmptyLine = true
    }
  }

  return { globalEffects, coinSections, paragraphBreaks }
}

interface SkillDescriptionProps {
  description: string
  accentColor: string
  variant?: SkillDescVariant
  skillNameColors?: Record<string, string>
  showCoinBadges?: boolean
  allowedKeywords?: Set<string>
  level4Desc?: string
}

export default function SkillDescription({
  description,
  accentColor,
  variant = 'detail',
  skillNameColors,
  showCoinBadges,
  allowedKeywords,
  level4Desc,
}: SkillDescriptionProps) {
  const formatSkillDesc = useFormatSkillDesc()
  const styles = SKILL_DESC_STYLES[variant]
  const showBadges = showCoinBadges ?? variant !== 'tooltip'

  if (!description) return null

  const { globalEffects, coinSections, paragraphBreaks } = parseDescription(description)
  const parsed4 = level4Desc ? parseDescription(level4Desc) : null

  return (
    <div style={{ color: styles.color, fontSize: styles.fontSize, lineHeight: styles.lineHeight, whiteSpace: 'pre-line' }}>
      {/* 전체 효과 + 4동기화 diff */}
      {globalEffects.map((line, i) => {
        const newLine = parsed4?.globalEffects[i]
        const hasDiff = newLine !== undefined && newLine !== line
        const prevDiff = i > 0 && parsed4?.globalEffects[i - 1] !== undefined && parsed4?.globalEffects[i - 1] !== globalEffects[i - 1]
        const isLast = i === globalEffects.length - 1
        const isParagraphStart = paragraphBreaks.has(i)
        // 마지막 전체효과 줄 뒤에 4동기화 추가 줄도 붙임
        const extraLines = isLast && parsed4 && parsed4.globalEffects.length > globalEffects.length
          ? parsed4.globalEffects.slice(globalEffects.length)
          : []
        return (
          <div key={`g-${i}`} style={isParagraphStart ? { marginTop: '0.625rem' } : undefined}>
            <div>{formatSkillDesc(line, accentColor, skillNameColors, allowedKeywords)}</div>
            {hasDiff && (
              <div className="flex items-start gap-1 mt-0.5" style={{ opacity: 0.35 }}>
                {!prevDiff ? (
                  <Image src={`${STORAGE_BASE}/icons/ui/lock.webp`} alt="" width={118} height={157} className="shrink-0" style={{ width: '0.5625rem', height: 'auto', marginTop: '0.125rem' }} />
                ) : (
                  <span className="shrink-0" style={{ width: '0.75rem' }} />
                )}
                <span>{formatSkillDesc(newLine, accentColor, skillNameColors, allowedKeywords)}</span>
              </div>
            )}
            {extraLines.map((eLine, ei) => (
              <div key={`g4-${ei}`} className="flex items-start gap-1 mt-0.5" style={{ opacity: 0.35 }}>
                {ei === 0 && !hasDiff ? (
                  <Image src={`${STORAGE_BASE}/icons/ui/lock.webp`} alt="" width={118} height={157} className="shrink-0" style={{ width: '0.5625rem', height: 'auto', marginTop: '0.125rem' }} />
                ) : (
                  <span className="shrink-0" style={{ width: '0.75rem' }} />
                )}
                <span>{formatSkillDesc(eLine, accentColor, skillNameColors, allowedKeywords)}</span>
              </div>
            ))}
          </div>
        )
      })}

      {/* 코인별 효과 */}
      {coinSections.map((coin, ci) => (
        <div key={`c-${ci}`}>
          {/* 구분선 */}
          {styles.dividerOpacity && (ci > 0 || globalEffects.length > 0) && (
            <div style={{ borderTop: `1px solid ${accentColor}${styles.dividerOpacity}`, margin: '0.375rem 0' }} />
          )}

          {showBadges ? (
            <div className="flex items-start gap-2">
              <CoinBadge
                number={coin.coinNum}
                accentColor={accentColor}
                isUnbreakable={coin.isUnbreakable}
              />
              <div style={{ flex: 1 }}>
                {coin.isUnbreakable && (
                  <span className="inline-flex items-center gap-1" style={{ color: '#aaa', fontSize: '0.625rem', fontWeight: 600 }}>
                    <Image
                      src={`${STORAGE_BASE}/icons/stats/unbreakable_coin.webp`}
                      alt=""
                      width={12}
                      height={12}
                      style={{ width: '0.75rem', height: '0.75rem', filter: `drop-shadow(0 0 2px ${accentColor}60)` }}
                    />
                    파괴 불가 코인
                  </span>
                )}
                {coin.lines.map((line, li) => {
                  const coin4 = parsed4?.coinSections[ci]
                  const newLine = coin4?.lines[li]
                  const hasDiff = newLine !== undefined && newLine !== line
                  const prevDiff = li > 0 && coin4?.lines[li - 1] !== undefined && coin4?.lines[li - 1] !== coin.lines[li - 1]
                  return (
                    <div key={li}>
                      <div>{formatSkillDesc(line, accentColor, skillNameColors, allowedKeywords)}</div>
                      {hasDiff && (
                        <div className="flex items-start gap-1 mt-0.5" style={{ opacity: 0.35 }}>
                          {!prevDiff ? (
                            <Image src={`${STORAGE_BASE}/icons/ui/lock.webp`} alt="" width={118} height={157} className="shrink-0" style={{ width: '0.5625rem', height: 'auto', marginTop: '0.125rem' }} />
                          ) : (
                            <span className="shrink-0" style={{ width: '0.75rem' }} />
                          )}
                          <span>{formatSkillDesc(newLine, accentColor, skillNameColors, allowedKeywords)}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <>
              {coin.lines.map((line, li) => {
                const coin4 = parsed4?.coinSections[ci]
                const newLine = coin4?.lines[li]
                const hasDiff = newLine !== undefined && newLine !== line
                const prevDiff = li > 0 && coin4?.lines[li - 1] !== undefined && coin4?.lines[li - 1] !== coin.lines[li - 1]
                return (
                  <div key={li}>
                    <div>
                      {li === 0 && <span style={{ color: accentColor, fontWeight: 600 }}>[코인 {coin.coinNum}] </span>}
                      {coin.isUnbreakable && li === 0 && (
                        <span style={{ fontWeight: 600 }}>파괴 불가 코인 </span>
                      )}
                      {formatSkillDesc(line, accentColor, skillNameColors, allowedKeywords)}
                    </div>
                    {hasDiff && (
                      <div className="flex items-start gap-1 mt-0.5" style={{ opacity: 0.35 }}>
                        {!prevDiff ? (
                          <Image src={`${STORAGE_BASE}/icons/ui/lock.webp`} alt="" width={118} height={157} className="shrink-0" style={{ width: '0.5625rem', height: 'auto', marginTop: '0.125rem' }} />
                        ) : (
                          <span className="shrink-0" style={{ width: '0.75rem' }} />
                        )}
                        <span>{formatSkillDesc(newLine, accentColor, skillNameColors, allowedKeywords)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
              {coin.lines.length === 0 && coin.isUnbreakable && (
                <div>
                  <span style={{ color: accentColor, fontWeight: 600 }}>[코인 {coin.coinNum}] </span>
                  <span style={{ fontWeight: 600 }}>파괴 불가 코인</span>
                </div>
              )}
            </>
          )}
        </div>
      ))}

    </div>
  )
}

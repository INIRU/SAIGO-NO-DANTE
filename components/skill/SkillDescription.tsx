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
  const coinSections: CoinSection[] = []
  let currentCoin: CoinSection | null = null

  for (const line of lines) {
    const coinMatch = line.match(/^\[코인\s?(\d+)\]\s*(.*)/)
    if (coinMatch) {
      currentCoin = { coinNum: parseInt(coinMatch[1]), isUnbreakable: false, lines: [] }
      coinSections.push(currentCoin)
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
      globalEffects.push(line.trim())
    }
  }

  return { globalEffects, coinSections }
}

interface SkillDescriptionProps {
  description: string
  accentColor: string
  variant?: SkillDescVariant
  skillNameColors?: Record<string, string>
  showCoinBadges?: boolean
  allowedKeywords?: Set<string>
}

export default function SkillDescription({
  description,
  accentColor,
  variant = 'detail',
  skillNameColors,
  showCoinBadges,
  allowedKeywords,
}: SkillDescriptionProps) {
  const formatSkillDesc = useFormatSkillDesc()
  const styles = SKILL_DESC_STYLES[variant]
  const showBadges = showCoinBadges ?? variant !== 'tooltip'

  if (!description) return null

  const { globalEffects, coinSections } = parseDescription(description)

  return (
    <div style={{ color: styles.color, fontSize: styles.fontSize, lineHeight: styles.lineHeight, whiteSpace: 'pre-line' }}>
      {/* 전체 효과 */}
      {globalEffects.map((line, i) => (
        <div key={`g-${i}`}>{formatSkillDesc(line, accentColor, skillNameColors, allowedKeywords)}</div>
      ))}

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
                {coin.lines.map((line, li) => (
                  <div key={li}>{formatSkillDesc(line, accentColor, skillNameColors, allowedKeywords)}</div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {coin.lines.map((line, li) => (
                <div key={li}>
                  {li === 0 && <span style={{ color: accentColor, fontWeight: 600 }}>[코인 {coin.coinNum}] </span>}
                  {coin.isUnbreakable && li === 0 && (
                    <span style={{ fontWeight: 600 }}>파괴 불가 코인 </span>
                  )}
                  {formatSkillDesc(line, accentColor, skillNameColors, allowedKeywords)}
                </div>
              ))}
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

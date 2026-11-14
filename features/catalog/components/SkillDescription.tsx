'use client'

import Image from 'next/image'
import { getLockIconUrl } from '@/lib/utils/images'
import { useFormatGameText, useFormatSkillDesc } from '@/components/providers/KeywordProvider'
import { useTranslations } from 'next-intl'
import CoinBadge from './CoinBadge'
import { parseSkillDescription } from '@/lib/identity/skill-description'
import { SKILL_DESC_STYLES, type SkillDescVariant } from '@/features/catalog/lib/skill-desc-styles'
import { FLAVOR_COLOR } from '@/lib/game-text/flavor'

/** The unbreakable-coin marker as game text: drawn as the [SuperCoin] keyword (icon, name, tooltip with its description). */
const UNBREAKABLE_COIN_REF = '[SuperCoin]'

interface SkillDescriptionProps {
  description: string
  accentColor: string
  variant?: SkillDescVariant
  skillNameColors?: Record<string, string>
  showCoinBadges?: boolean
  /** keyword_meta names the identity / E.G.O owns (the plain keywords of older text are searched among these). */
  allowedKeywords?: ReadonlySet<string>
  /** Skill or passive text of an identity / E.G.O: draw `allowedKeywords` written as plain words. */
  matchPlainKeywords?: boolean
  level4Desc?: string
  flavorText?: string | null
}

export default function SkillDescription({
  description,
  accentColor,
  variant = 'detail',
  skillNameColors,
  showCoinBadges,
  allowedKeywords,
  matchPlainKeywords,
  level4Desc,
  flavorText,
}: SkillDescriptionProps) {
  const formatSkillDescOf = useFormatSkillDesc()
  const formatOptions = matchPlainKeywords ? { matchPlainKeywords } : undefined
  const formatSkillDesc = (text: string, color: string, names?: Record<string, string>, allowed?: ReadonlySet<string>) =>
    formatSkillDescOf(text, color, names, allowed, formatOptions)
  const formatGameText = useFormatGameText()
  const t = useTranslations()
  const styles = SKILL_DESC_STYLES[variant]
  const showBadges = showCoinBadges ?? variant !== 'tooltip'
  const flavor = flavorText?.trim()

  if (!description && !flavor) return null

  const { globalEffects, coinSections, paragraphBreaks } = parseSkillDescription(description)
  const parsed4 = level4Desc ? parseSkillDescription(level4Desc) : null
  const hasEffectLines = globalEffects.length > 0 || coinSections.length > 0

  return (
    <div style={{ color: styles.color, fontSize: styles.fontSize, lineHeight: styles.lineHeight, whiteSpace: 'pre-line', overflowWrap: 'anywhere', textAlign: 'left' }}>
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
                  <Image src={getLockIconUrl()} alt="" width={118} height={157} className="shrink-0" style={{ width: '0.5625rem', height: 'auto', marginTop: '0.125rem' }} />
                ) : (
                  <span className="shrink-0" style={{ width: '0.75rem' }} />
                )}
                <span>{formatSkillDesc(newLine, accentColor, skillNameColors, allowedKeywords)}</span>
              </div>
            )}
            {extraLines.map((eLine, ei) => (
              <div key={`g4-${ei}`} className="flex items-start gap-1 mt-0.5" style={{ opacity: 0.35 }}>
                {ei === 0 && !hasDiff ? (
                  <Image src={getLockIconUrl()} alt="" width={118} height={157} className="shrink-0" style={{ width: '0.5625rem', height: 'auto', marginTop: '0.125rem' }} />
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
            <div className="flex items-start gap-2.5">
              <CoinBadge number={coin.coinNum} />
              <div style={{ flex: 1, minWidth: 0, paddingTop: '0.125rem' }}>
                {/* The game's own [SuperCoin] keyword: its icon, and its description in a tooltip. */}
                {coin.isUnbreakable && <div>{formatSkillDesc(UNBREAKABLE_COIN_REF, accentColor)}</div>}
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
                            <Image src={getLockIconUrl()} alt="" width={118} height={157} className="shrink-0" style={{ width: '0.5625rem', height: 'auto', marginTop: '0.125rem' }} />
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
                      {li === 0 && <span style={{ color: accentColor, fontWeight: 600 }}>[{t('identity.skills.coin')} {coin.coinNum}] </span>}
                      {coin.isUnbreakable && li === 0 && <>{formatSkillDesc(UNBREAKABLE_COIN_REF, accentColor)} </>}
                      {formatSkillDesc(line, accentColor, skillNameColors, allowedKeywords)}
                    </div>
                    {hasDiff && (
                      <div className="flex items-start gap-1 mt-0.5" style={{ opacity: 0.35 }}>
                        {!prevDiff ? (
                          <Image src={getLockIconUrl()} alt="" width={118} height={157} className="shrink-0" style={{ width: '0.5625rem', height: 'auto', marginTop: '0.125rem' }} />
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
                  <span style={{ color: accentColor, fontWeight: 600 }}>[{t('identity.skills.coin')} {coin.coinNum}] </span>
                  {formatSkillDesc(UNBREAKABLE_COIN_REF, accentColor)}
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {flavor && (
        <div
          style={{
            marginTop: hasEffectLines ? '0.5rem' : 0,
            color: FLAVOR_COLOR,
            fontStyle: 'italic',
            fontSize: '0.95em',
            lineHeight: 1.55,
            whiteSpace: 'pre-line',
          }}
        >
          {formatGameText(flavor, FLAVOR_COLOR)}
        </div>
      )}
    </div>
  )
}

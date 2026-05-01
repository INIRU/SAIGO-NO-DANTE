'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import KeywordChip from '@/components/ui/KeywordChip'
import type { GiftData, ThemeData } from '@/lib/planner/types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useFormatSkillDesc } from '@/components/sinners/KeywordTooltip'
import { STORAGE_BASE } from '@/lib/constants/game'
import { OCTAGON_CLIP, GRADE_ROMAN, getGiftKeywordColor } from '@/lib/constants/gift'
import BaseModal from '@/components/ui/BaseModal'
import { normalizeForStats, normalizeThemeKeyword } from '@/lib/constants/keywords'

const S = STORAGE_BASE

export interface RecipeLookup {
  materials: GiftData[]
  result: GiftData
  pseudoIngredients?: string[]
}

interface Props {
  gift: GiftData
  onClose: () => void
  themes?: ThemeData[]
  onThemeClick?: (themeId: string) => void
  enhance?: number
  conditionStatus?: GiftConditionStatus | null
  recipe?: RecipeLookup | null
}

export type GiftConditionStatus = { level: 'warn' | 'unmet'; text: string }

export function getGiftActivationConditionStatus({
  gift,
  formationKeywordCounts,
  allKeywordCounts,
  formationAffiliationCounts = {},
  allAffiliationCounts = {},
}: {
  gift: Pick<GiftData, 'activation_condition'>
  formationKeywordCounts: Record<string, number>
  allKeywordCounts: Record<string, number>
  formationAffiliationCounts?: Record<string, number>
  allAffiliationCounts?: Record<string, number>
}): GiftConditionStatus | null {
  const cond = gift.activation_condition
  if (!cond || !cond.count) return null

  let formationHave = 0
  let allHave = 0
  let label = ''
  const countThemeKeyword = (counts: Record<string, number>, keyword: string): number => {
    const normalizedKeyword = normalizeThemeKeyword(keyword)
    return Object.entries(counts).reduce((sum, [rawKeyword, count]) => (
      normalizeForStats(rawKeyword) === normalizedKeyword ? sum + count : sum
    ), 0)
  }

  if (cond.type === 'keyword' && cond.keyword) {
    formationHave = countThemeKeyword(formationKeywordCounts, cond.keyword)
    allHave = countThemeKeyword(allKeywordCounts, cond.keyword)
    label = cond.keyword
  } else if (cond.type === 'multi_keyword' && cond.keywords) {
    formationHave = cond.keywords.reduce((sum, kw) => sum + countThemeKeyword(formationKeywordCounts, kw), 0)
    allHave = cond.keywords.reduce((sum, kw) => sum + countThemeKeyword(allKeywordCounts, kw), 0)
    label = cond.keywords.join('+')
  } else if (cond.type === 'affiliation') {
    const affiliations = cond.affiliations ?? (cond.affiliation ? [cond.affiliation] : [])
    formationHave = affiliations.reduce((sum, affiliation) => sum + (formationAffiliationCounts[affiliation] ?? 0), 0)
    allHave = affiliations.reduce((sum, affiliation) => sum + (allAffiliationCounts[affiliation] ?? 0), 0)
    label = affiliations.join('/')
  } else {
    return null
  }

  if (formationHave >= cond.count) return null
  if (allHave >= cond.count) return { level: 'warn', text: `${label} ${formationHave}/${cond.count}` }
  return { level: 'unmet', text: `${label} ${allHave}/${cond.count}` }
}

export default function PlannerGiftModal({ gift, onClose, themes = [], onThemeClick, enhance, conditionStatus, recipe }: Props) {
  const { getIconUrl } = useKeywordData()
  const kwColor = getGiftKeywordColor(gift.keyword ?? null)
  const gradeLabel = GRADE_ROMAN[gift.grade ?? '1'] ?? gift.grade
  const isEX = gift.grade === 'EX'
  const kwIconUrl = gift.keyword ? getIconUrl(gift.keyword) : null

  // 소속 테마팩
  const giftThemes = themes.filter(t =>
    (t.ego_gift_ids ?? []).includes(gift.game_id) || (t.specific_ego_gift_ids ?? []).includes(gift.game_id)
  )

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="32rem" padding="1rem" title="선물 상세">
      <div
        className="relative w-full max-h-[85vh] overflow-y-auto rounded-xl"
        style={{ background: '#131110', border: `1px solid ${kwColor}30`, boxShadow: `0 0 3rem ${kwColor}10, 0 1.5rem 4rem rgba(0,0,0,0.6)` }}
      >
        {/* 닫기 */}
        <button onClick={onClose} aria-label="닫기" className="absolute top-3 right-3 z-20 p-1.5 rounded-full transition-colors hover:bg-white/10" style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
          <X size={18} />
        </button>

        {/* 배너 헤더 */}
        <div className="relative overflow-hidden" style={{ height: '7.5rem', background: `linear-gradient(135deg, ${kwColor}15 0%, transparent 60%)` }}>
          {kwIconUrl && (
            <div className="absolute -right-4 -top-4 opacity-[0.06]" style={{ width: '10rem', height: '10rem' }}>
              <Image src={kwIconUrl} alt="" fill sizes="160px" className="object-contain" />
            </div>
          )}
          <div className="absolute" style={{ inset: '-1px', background: 'linear-gradient(to top, #131110 0%, transparent 100%)' }} />

          <div className="absolute bottom-0 left-0 right-0 flex items-end gap-4 px-5 pb-3">
            {/* 기프트 카드 */}
            <div className="relative flex-shrink-0 overflow-hidden" style={{
              width: '5rem', height: '5rem',
              backgroundImage: `url(${S}/icons/ego-gift-bg.webp)`, backgroundSize: 'cover', backgroundPosition: 'center',
              clipPath: OCTAGON_CLIP,
            }}>
              <span className="absolute top-[4%] left-[5%] z-10 pointer-events-none" style={{
                fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                fontWeight: 700, fontSize: '1.5rem', lineHeight: 1,
                color: isEX ? 'rgb(198, 255, 46)' : 'rgb(251, 183, 46)',
                textShadow: isEX
                  ? '0 0 0.625rem rgb(251,255,8), 0 0 0.25rem rgb(12,90,0)'
                  : '0 0 0.375rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
              }}>
                {gradeLabel}
              </span>
              {kwIconUrl && (
                <div className="absolute bottom-0 right-0 z-10 w-[30%] h-[30%] pointer-events-none">
                  <Image src={kwIconUrl} alt="" fill sizes="24px" className="object-contain" />
                </div>
              )}
              <div className="absolute inset-[10%] flex items-center justify-center">
                {gift.image_url ? (
                  <div className="relative w-full h-full">
                    <Image src={gift.image_url} alt={gift.name} fill className="object-contain" sizes="70px" />
                  </div>
                ) : (
                  <div style={{ width: '2rem', height: '2rem', background: '#333', borderRadius: '50%' }} />
                )}
              </div>
              {/* 강화 배지 */}
              {enhance != null && enhance > 0 && (
                <span className="absolute top-[2%] right-[6%] z-15 pointer-events-none" style={{
                  fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                  fontWeight: 800, fontSize: '1.5rem', lineHeight: 1,
                  color: enhance === 2 ? '#ff8c00' : '#e8b030',
                  textShadow: enhance === 2
                    ? '0 0 0.5rem rgba(255,140,0,0.8)'
                    : '0 0 0.375rem rgba(200,144,10,0.6)',
                }}>
                  {enhance === 2 ? '++' : '+'}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 pb-0.5">
              <h2 className="font-serif text-lg md:text-xl font-bold leading-tight" style={{ color: '#e8d8c0', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                {gift.name}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {gift.keyword && <KeywordChip keyword={gift.keyword} />}
                {gift.effect_plus && (
                  <span className="px-2 py-0.5 rounded-full text-[0.625rem]" style={{ background: 'rgba(64,160,96,0.15)', color: '#40a060' }}>
                    강화 가능
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 효과 */}
        <div className="px-5 pb-4 space-y-3">
          {gift.effect_base && <EffectBlock label="기본" text={gift.effect_base} color="#888" active={!enhance || enhance === 0} />}
          {gift.effect_plus && <EffectBlock label="+" text={gift.effect_plus} color="#a0a0a0" active={enhance === 1} />}
          {gift.effect_plusplus && <EffectBlock label="++" text={gift.effect_plusplus} color="#e8b030" active={enhance === 2} />}

          {/* 발동 조건 */}
          {gift.activation_condition && (
            <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="grid grid-cols-2 gap-2">
                <MetaItem
                  label={(() => {
                    const c = gift.activation_condition
                    if (c.type === 'keyword') return `${c.keyword} 인격`
                    if (c.type === 'multi_keyword') return `${c.keywords!.join('+')} 인격`
                    if (c.type === 'affiliation') return `${c.affiliation ?? c.affiliations!.join('/')} 소속`
                    return '발동 조건'
                  })()}
                  value={`${gift.activation_condition.count}인 이상`}
                  valueColor={conditionStatus?.level === 'unmet' ? '#ef4444' : conditionStatus?.level === 'warn' ? '#e8b030' : '#4ade80'}
                />
              </div>
              {conditionStatus && (
                <div style={{
                  marginTop: '0.375rem', padding: '0.375rem 0.5rem', borderRadius: '0.25rem',
                  background: conditionStatus.level === 'unmet' ? 'rgba(239,68,68,0.1)' : 'rgba(232,176,48,0.1)',
                  border: `1px solid ${conditionStatus.level === 'unmet' ? 'rgba(239,68,68,0.2)' : 'rgba(232,176,48,0.2)'}`,
                }}>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 600,
                    color: conditionStatus.level === 'unmet' ? '#ef4444' : '#e8b030',
                  }}>
                    {conditionStatus.level === 'unmet' ? '⛔ 조건 미달' : '⚠️ 조건 주의'}: {conditionStatus.text}
                  </span>
                  <div style={{ fontSize: '0.625rem', color: '#6b7280', marginTop: '0.125rem' }}>
                    {conditionStatus.level === 'unmet'
                      ? '편성 + 대기 인격을 모두 포함해도 조건이 부족합니다'
                      : '편성(1-7)만으로는 부족하지만, 대기 인격을 포함하면 충족됩니다'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 조합법 */}
          {recipe && (
            <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="font-bold mb-1.5" style={{ color: '#b478dc', fontFamily: 'var(--font-heading)', fontSize: '0.625rem' }}>
                조합 레시피
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {recipe.materials.map((mat, i) => (
                  <span key={mat.game_id} className="flex items-center">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[0.6875rem]" style={{ background: 'rgba(255,255,255,0.05)', color: '#bbb' }}>
                      {mat.image_url && <Image src={mat.image_url} alt="" width={16} height={16} style={{ width: '1rem', height: '1rem', objectFit: 'contain' }} />}
                      {mat.name}
                    </span>
                    {i < recipe.materials.length - 1 && (
                      <span style={{ color: '#444', margin: '0 0.125rem', fontFamily: 'sans-serif' }}>+</span>
                    )}
                  </span>
                ))}
                {recipe.pseudoIngredients?.map((pi, i) => (
                  <span key={`pseudo-${i}`} className="flex items-center">
                    {(recipe.materials.length > 0 || i > 0) && (
                      <span style={{ color: '#444', margin: '0 0.125rem', fontFamily: 'sans-serif' }}>+</span>
                    )}
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[0.625rem]"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        color: '#999',
                        fontStyle: 'italic',
                      }}
                    >
                      {pi}
                    </span>
                  </span>
                ))}
                <span style={{ color: '#555', margin: '0 0.25rem', fontFamily: 'sans-serif' }}>=</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[0.6875rem] font-bold" style={{ background: `${kwColor}15`, color: kwColor }}>
                  {gift.image_url && <Image src={gift.image_url} alt="" width={16} height={16} style={{ width: '1rem', height: '1rem', objectFit: 'contain' }} />}
                  {gift.name}
                </span>
              </div>
            </div>
          )}

          {/* 소속 테마팩 */}
          {giftThemes.length > 0 && (
            <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="font-bold mb-1.5" style={{ color: '#666', fontFamily: 'var(--font-heading)', fontSize: '0.625rem' }}>
                소속 테마팩
              </p>
              <div className="flex flex-wrap gap-1.5">
                {giftThemes.map(t => {
                  const isExclusive = (t.specific_ego_gift_ids ?? []).includes(gift.game_id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => onThemeClick?.(t.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-white/10"
                      style={{
                        cursor: onThemeClick ? 'pointer' : 'default',
                        background: isExclusive ? 'rgba(200,144,10,0.12)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isExclusive ? 'rgba(200,144,10,0.25)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      {isExclusive && <span style={{ color: '#c8900a', fontSize: '0.5625rem' }}>★</span>}
                      {t.image_url && <Image src={t.image_url} alt="" width={14} height={25} style={{ width: '0.55rem', height: '1rem', objectFit: 'cover', borderRadius: '1px' }} />}
                      <span style={{ color: '#bbb', fontSize: '0.6875rem' }}>{t.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  )
}

function EffectBlock({ label, text, color, active }: { label: string; text: string; color: string; active?: boolean }) {
  const formatSkillDesc = useFormatSkillDesc()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return (
    <div style={{ opacity: active ? 1 : 0.5 }}>
      <p className="text-[0.625rem] font-bold mb-1.5" style={{
        color: active ? (label === '++' ? '#e8b030' : color) : '#555',
        fontFamily: 'var(--font-heading)',
      }}>
        효과 {label}
      </p>
      <div className="text-[0.75rem] leading-[1.7]" style={{ color: active ? '#c8b898' : '#666' }}>
        {lines.map((line, i) => {
          const isSub = /^-\s/.test(line)
          return (
            <p key={i} style={isSub
              ? { paddingLeft: '0.75rem', textIndent: '-0.5rem', marginTop: '0.125rem' }
              : { marginTop: i > 0 ? '0.375rem' : 0 }
            }>
              {formatSkillDesc(line, active ? color : '#666')}
            </p>
          )
        })}
      </div>
    </div>
  )
}

function MetaItem({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
      <span style={{ color: '#555', fontSize: '0.5625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ color: valueColor ?? '#bbb', fontSize: '0.8125rem', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

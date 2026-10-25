'use client'

import { getEgoGradeBannerUrl } from '@/lib/utils/images'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import { STORAGE_BASE, GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, SIN_ORDER, getSinIconUrl, normalizeSin } from '@/lib/constants/sin'
import SkillDescription from '@/components/skill/SkillDescription'
import { useOwnKeywords } from '@/lib/hooks/useOwnKeywords'
import { descriptionTexts } from '@/lib/keywords/own-keywords'
import { useTranslations, useLocale } from 'next-intl'
import { getLocalizedName } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n/types'
import type { TranslationKey } from '@/lib/i18n'
import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'

// ── 타입 ──────────────────────────────────────────────────────────────────
type EgoSkillData = {
  id: string
  name: string
  name_en?: string | null
  name_jp?: string | null
  description_en?: string | null
  description_jp?: string | null
  skill_type: string
  sin_affinity: string
  base_power: number
  coins: number
  coin_power: number
  description: string | null
  category: string
  construe_level: number | null
  game_skill_id?: number | null
  offense_level: number | null
  atk_weight: number | null
}

type EgoData = {
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  name_en?: string | null
  name_jp?: string | null
  grade: string
  sin_affinity: string | null
  folder_name: string | null
  image_url: string | null
  passive_name: string | null
  passive_content: string | null
  resistance: string[] | null
  cost: number[] | null
  resistances: Record<string, string>
  costs: Record<string, number>
  keywords: string[] | null
  description: string | null
  corrosion_risk: string | null
  obtaining_method: string | null
  obtaining_method_en?: string | null
  obtaining_method_jp?: string | null
}

type ApiResponse = {
  ego: EgoData
  sinner: { name_kr: string; name_en?: string | null; name_jp?: string | null } | null
  skills: EgoSkillData[]
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function getResStyle(value: string, t: (key: TranslationKey) => string): { color: string; label: string } {
  const map: Record<string, { color: string; tKey: TranslationKey }> = {
    '내성': { color: '#4488dd', tKey: 'ego.res.resist' },
    '견딤': { color: '#4488dd', tKey: 'ego.res.endure' },
    'resist': { color: '#4488dd', tKey: 'ego.res.resist' },
    '보통': { color: '#667788', tKey: 'ego.res.normal' },
    'normal': { color: '#667788', tKey: 'ego.res.normal' },
    '취약': { color: '#e06070', tKey: 'ego.res.weak' },
    'weak': { color: '#e06070', tKey: 'ego.res.weak' },
    '치명': { color: '#e04040', tKey: 'ego.res.fatal' },
    'fatal': { color: '#e04040', tKey: 'ego.res.fatal' },
    '무효': { color: '#40c060', tKey: 'ego.res.null' },
    '면역': { color: '#40c060', tKey: 'ego.res.immune' },
    'immune': { color: '#40c060', tKey: 'ego.res.null' },
  }
  const entry = map[value]
  if (entry) return { color: entry.color, label: t(entry.tKey) }
  return { color: '#667788', label: value }
}

function sinIconUrl(sin: string): string {
  const normalized = normalizeSin(sin)
  if (normalized) return getSinIconUrl(normalized)
  const cap = sin.charAt(0).toUpperCase() + sin.slice(1)
  return `${STORAGE_BASE}/icons/Sins/transparent/${cap}.webp`
}

function bestConstrue<T extends { construe_level: number | null; game_skill_id?: number | null; name: string }>(items: T[]): T[] {
  const groups = new Map<string, T>()
  for (const item of items) {
    const key = String(item.game_skill_id ?? item.name)
    const ex = groups.get(key)
    if (!ex || (item.construe_level ?? 3) > (ex.construe_level ?? 3)) {
      groups.set(key, item)
    }
  }
  return [...groups.values()]
}

function getLocalizedObtainingMethod(ego: EgoData, lang: SupportedLang): string | null {
  if (lang === 'en') return ego.obtaining_method_en ?? ego.obtaining_method
  if (lang === 'ja') return ego.obtaining_method_jp ?? ego.obtaining_method
  return ego.obtaining_method
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────
interface EgoDetailModalProps {
  egoId: string
  onClose: () => void
}

export default function EgoDetailModal({ egoId, onClose }: EgoDetailModalProps) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations()
  const locale = useLocale()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/ego/${egoId}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((d: ApiResponse) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError(t('ego.loadError')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [egoId])

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="32rem" padding="1rem" title={t('ego.detailTitle')}>
      <div
        className="relative w-full overflow-y-auto rounded-xl"
        style={{
          maxHeight: '85vh',
          background: '#131110',
          border: '1px solid rgba(200,144,10,0.15)',
          boxShadow: '0 0 3rem rgba(200,144,10,0.05), 0 1.5rem 4rem rgba(0,0,0,0.6)',
        }}
      >
        <button
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-full transition-colors hover:bg-white/10"
          style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
        >
          <X size={18} />
        </button>

        {loading && <LoadingSkeleton />}
        {error && (
          <div className="p-6 text-center" style={{ color: '#c84050', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        {data && !loading && <ModalContent data={data} lang={locale as SupportedLang} t={t} />}
      </div>
    </BaseModal>
  )
}

// ── 로딩 스켈레톤 ────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <SkeletonPage className="space-y-4 p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 shrink-0" />
        <div className="flex-1 space-y-2"><SkeletonLine w="60%" h="1rem" /><SkeletonLine w="40%" h="0.75rem" /></div>
      </div>
      <div className="flex gap-4 border-b border-[#2e2417] pb-2"><SkeletonLine w="2.5rem" h="0.875rem" /><SkeletonLine w="3rem" h="0.875rem" /><SkeletonLine w="3rem" h="0.875rem" /></div>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex gap-3 rounded-lg border border-[#2e2417] p-3">
          <Skeleton className="h-10 w-10 shrink-0" />
          <div className="flex-1 space-y-2"><SkeletonLine w="35%" h="0.875rem" /><SkeletonLine w="90%" h="0.75rem" /><SkeletonLine w="70%" h="0.75rem" /></div>
        </div>
      ))}
    </SkeletonPage>
  )
}

// ── 모달 본문 ─────────────────────────────────────────────────────────────
function ModalContent({ data, lang, t }: { data: ApiResponse; lang: SupportedLang; t: (key: TranslationKey) => string }) {
  const { ego, sinner, skills } = data
  // The keywords of this E.G.O (its keyword list and what its own skills and passive reference): plain words of older text are searched among these.
  const ownTexts = useMemo(() => [...descriptionTexts(skills), ...(ego.passive_content ? [ego.passive_content] : [])], [skills, ego.passive_content])
  const allowedKeywords = useOwnKeywords(ego.keywords, ownTexts)

  const gradeColor = GRADE_COLORS[ego.grade] ?? '#667788'
  const sinType = normalizeSin(ego.sin_affinity)
  const egoSinColor = sinType ? SIN_COLORS[sinType] : gradeColor

  // 각 스킬의 실제 최대 해석 단계
  const awakening = bestConstrue(skills.filter(s => s.category === 'awakening'))
  const corrosion = bestConstrue(skills.filter(s => s.category === 'corrosion'))

  // 내성 배열 (API에서 resistances 객체로 변환됨)
  const resistances = SIN_ORDER.map(sin => ({
    sin,
    value: ego.resistances?.[sin] ?? '보통',
  }))

  // 코스트 배열 (0이 아닌 것만)
  const costs = SIN_ORDER
    .map(sin => ({ sin, amount: ego.costs?.[sin] ?? 0 }))
    .filter(c => c.amount > 0)
  const obtainingMethod = getLocalizedObtainingMethod(ego, lang)

  return (
    <div>
      {/* ── 헤더 ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${gradeColor}12 0%, transparent 60%)` }}>
        <div className="flex gap-3 p-5 pb-4">
          {ego.image_url && (
            <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: '4.5rem', height: '4.5rem', border: `1px solid ${gradeColor}40` }}>
              <Image
                src={ego.image_url} alt={getLocalizedName({ name_kr: ego.name_kr ?? ego.name, name_en: ego.name_en, name_jp: ego.name_jp }, lang)}
                width={72} height={72}
                style={{ width: '4.5rem', height: '4.5rem', objectFit: 'cover', objectPosition: 'center top' }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-serif" style={{ color: 'var(--text-primary)', fontSize: '1.0625rem', lineHeight: 1.2 }}>
                {getLocalizedName({ name_kr: ego.name_kr ?? ego.name, name_en: ego.name_en, name_jp: ego.name_jp }, lang)}
              </span>
            </div>
            {sinner && (
              <p style={{ color: '#8a7050', fontSize: '0.75rem', fontFamily: 'var(--font-body)', marginBottom: '0.375rem' }}>
                {getLocalizedName(sinner, lang)}
              </p>
            )}
            <div className="flex items-center gap-2">
              {/* 등급 이미지 */}
              {['ZAYIN','TETH','HE','WAW','ALEPH'].includes(ego.grade) ? (
                <Image src={getEgoGradeBannerUrl(ego.grade)} alt={ego.grade} width={40} height={14} unoptimized
                  style={{ height: '0.875rem', width: 'auto', opacity: 0.9 }} />
              ) : (
                <span className="px-1.5 py-0.5 rounded" style={{ background: `${gradeColor}18`, color: gradeColor, border: `1px solid ${gradeColor}38`, fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 600 }}>
                  {ego.grade}
                </span>
              )}
              {/* 죄악 아이콘 */}
              {sinType && (
                <Image src={getSinIconUrl(sinType)} alt={t(('sin.' + sinType) as TranslationKey)} width={16} height={16}
                  style={{ width: '1rem', height: '1rem', opacity: 0.8 }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 내성 & 코스트 ──────────────────────────────────────── */}
      <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(32,20,8,0.7)', borderBottom: '1px solid rgba(32,20,8,0.7)' }}>
        {/* 죄악 내성 */}
        <p style={{ color: '#888', fontSize: '0.6875rem', marginBottom: '0.375rem', fontFamily: 'var(--font-heading)' }}>{t('ego.resistance')}</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {resistances.map(({ sin, value }) => {
            const rs = getResStyle(value, t)
            const sc = SIN_COLORS[sin]
            return (
              <span key={sin} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: `${rs.color}15`, color: rs.color, border: `1px solid ${rs.color}30`, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                <Image src={getSinIconUrl(sin)} alt="" width={14} height={14}
                  style={{ width: '0.875rem', height: '0.875rem', filter: `drop-shadow(0 0 2px ${sc}60)` }} />
                <strong>{rs.label}</strong>
              </span>
            )
          })}
        </div>

        {/* 코스트 */}
        {costs.length > 0 && (
          <>
            <p style={{ color: '#888', fontSize: '0.6875rem', marginBottom: '0.375rem', fontFamily: 'var(--font-heading)' }}>{t('ego.cost')}</p>
            <div className="flex flex-wrap gap-2">
              {costs.map(({ sin, amount }) => {
                const sc = SIN_COLORS[sin]
                return (
                  <span key={sin} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: `${sc}15`, color: sc, border: `1px solid ${sc}30`, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    <Image src={getSinIconUrl(sin)} alt="" width={14} height={14}
                      style={{ width: '0.875rem', height: '0.875rem', filter: `drop-shadow(0 0 2px ${sc}60)` }} />
                    <strong>{amount}</strong>
                  </span>
                )
              })}
            </div>
          </>
        )}
      </div>

      {obtainingMethod && (
        <Section title={t('ego.acquisition')}>
          <div className="flex flex-wrap gap-1.5">
            {obtainingMethod.split(/\s*\/\s*/).map((part, index) => (
              <span
                key={`${part}-${index}`}
                className="rounded"
                style={{
                  color: index === 0 ? '#d8b768' : '#aaa',
                  background: index === 0 ? 'rgba(200,144,10,0.12)' : 'rgba(255,255,255,0.04)',
                  border: index === 0 ? '1px solid rgba(200,144,10,0.28)' : '1px solid rgba(255,255,255,0.08)',
                  fontSize: '0.6875rem',
                  lineHeight: 1.5,
                  padding: '0.1875rem 0.5rem',
                }}
              >
                {part}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ── 패시브 섹션 ──────────────────────────────────────── */}
      {ego.passive_name && (
        <Section title={t('ego.passive')}>
          <div className="p-2.5 rounded" style={{ background: `${egoSinColor}08`, border: `1px solid ${egoSinColor}20` }}>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: egoSinColor, fontSize: '0.75rem', fontWeight: 600 }}>{ego.passive_name}</span>
            </div>
            {ego.passive_content && (
              <div style={{ marginTop: '0.25rem', borderTop: `1px solid ${egoSinColor}15`, paddingTop: '0.375rem' }}>
                <SkillDescription description={ego.passive_content} accentColor={egoSinColor} variant="compact" allowedKeywords={allowedKeywords} matchPlainKeywords />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── 각성 스킬 섹션 ────────────────────────────────────── */}
      {awakening.length > 0 && (
        <Section title={t('ego.awakening')}>
          <div className="flex flex-col gap-2">
            {awakening.map(skill => (
              <EgoSkillCard key={skill.id} skill={skill} gradeColor={egoSinColor} lang={lang} t={t} allowedKeywords={allowedKeywords} />
            ))}
          </div>
        </Section>
      )}

      {/* ── 침식 스킬 섹션 ────────────────────────────────────── */}
      {corrosion.length > 0 && (
        <Section title={t('ego.corrosion')}>
          <div className="flex flex-col gap-2">
            {corrosion.map(skill => (
              <EgoSkillCard key={skill.id} skill={skill} gradeColor="#cc4444" isCorrosion lang={lang} t={t} allowedKeywords={allowedKeywords} />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

// ── Section 래퍼 ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(32,20,8,0.5)' }}>
      <h3 className="font-serif mb-2" style={{ color: 'var(--gold)', fontSize: '0.8125rem', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

// ── EgoSkillCard ──────────────────────────────────────────────────────────
function EgoSkillCard({ skill, gradeColor, isCorrosion, lang, t, allowedKeywords }: { skill: EgoSkillData; gradeColor: string; isCorrosion?: boolean; lang: SupportedLang; t: (key: TranslationKey) => string; allowedKeywords: ReadonlySet<string> }) {
  const accentColor = isCorrosion ? '#cc4444' : gradeColor
  const coinPowerStr = skill.coin_power >= 0 ? `+${skill.coin_power}` : `${skill.coin_power}`
  const maxPower = skill.coin_power < 0 ? skill.base_power : skill.base_power + skill.coins * skill.coin_power

  const localizedSkillName = lang === 'en' && skill.name_en
    ? skill.name_en
    : lang === 'ja' && skill.name_jp
      ? skill.name_jp
      : skill.name

  const localizedDesc = lang === 'en' && skill.description_en
    ? skill.description_en
    : lang === 'ja' && skill.description_jp
      ? skill.description_jp
      : skill.description

  return (
    <div className="p-2.5 rounded" style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}25` }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', padding: '0.125rem 0.375rem', borderRadius: '0.1875rem', background: isCorrosion ? 'rgba(180,20,20,0.15)' : `${accentColor}20`, color: isCorrosion ? '#cc4444' : accentColor, border: `1px solid ${isCorrosion ? 'rgba(180,20,20,0.3)' : accentColor + '40'}` }}>
            {isCorrosion ? t('ego.corrosionLabel') : t('ego.awakeningLabel')}
          </span>
          <span className="truncate" style={{ color: accentColor, fontSize: '0.75rem', fontWeight: 600 }}>{localizedSkillName}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Image src={sinIconUrl(skill.sin_affinity)} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.7 }} />
        </div>
      </div>

      {/* 수치 */}
      <div className="flex items-center gap-3 mb-1" style={{ fontSize: '0.6875rem', color: '#999' }}>
        <span>{t('ego.power')} <strong style={{ color: accentColor, fontFamily: 'var(--font-mono)' }}>{skill.base_power}</strong></span>
        <span>{t('ego.coin')} <strong style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>{skill.coins}</strong></span>
        <span>{t('ego.coinPower')} <strong style={{ color: accentColor, fontFamily: 'var(--font-mono)' }}>{coinPowerStr}</strong></span>
        {skill.atk_weight != null && skill.atk_weight !== 1 && (
          <span>{t('ego.weight')} <strong style={{ color: '#d0a020', fontFamily: 'var(--font-mono)' }}>{skill.atk_weight}</strong></span>
        )}
        <span style={{ marginLeft: 'auto' }}>{t('ego.max')} <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{maxPower}</strong></span>
      </div>

      {/* 스킬 설명 */}
      {localizedDesc && (
        <div style={{ marginTop: '0.375rem', borderTop: `1px solid ${accentColor}15`, paddingTop: '0.375rem' }}>
          <SkillDescription description={localizedDesc} accentColor={accentColor} variant="compact" allowedKeywords={allowedKeywords} matchPlainKeywords />
        </div>
      )}
    </div>
  )
}

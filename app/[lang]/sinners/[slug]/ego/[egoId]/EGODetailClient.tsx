'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import {
  Sinner, EGO, EGOSkill, STORAGE_BASE,
  SIN_COLORS, SinType,
  GRADE_COLORS, SIN_KR_TO_EN,
  getSinIconUrl,
  SIN_ORDER,
} from '@/lib/data/sinners'
import SkillFrameBlock from '@/components/identity/SkillFrameBlock'
import SkillDescription from '@/components/skill/SkillDescription'
import { getGiftKeywordColor } from '@/lib/constants/gift'
import { useKeywords } from '@/components/providers/KeywordProvider'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
import { getLocalizedName, getLocalizedKeywordName } from '@/lib/i18n'
import { useTranslations, useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'

// ─── 상수 ────────────────────────────────────────────────────────────
const RESISTANCE_STYLE: Record<string, { color: string; bg: string }> = {
  '내성': { color: '#4488dd', bg: 'rgba(44,88,180,0.15)' },
  '견딤': { color: '#9966cc', bg: 'rgba(120,80,180,0.15)' },
  '보통': { color: '#556677', bg: 'rgba(60,70,80,0.12)' },
  '취약': { color: '#cc4444', bg: 'rgba(160,40,40,0.15)' },
}

// Korean resistance value → translation key
const RES_KEY_MAP: Record<string, string> = {
  '내성': 'ego.res.resist',
  '견딤': 'ego.res.endure',
  '보통': 'ego.res.normal',
  '취약': 'ego.res.weak',
  '치명': 'ego.res.fatal',
  '무효': 'ego.res.null',
  '면역': 'ego.res.immune',
}

// ─── Grade 이미지 ─────────────────────────────────────────────────────
function GradeImg({ grade, height = 16 }: { grade: string; height?: number }) {
  if (grade === 'ALEPH') return (
    <span style={{ fontFamily: 'monospace', fontSize: `${height - 2}px`, color: '#c83040', letterSpacing: '0.1em' }}>
      ALEPH
    </span>
  )
  return (
    <Image
      src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
      alt={grade}
      width={40}
      height={height}
      unoptimized
      style={{ width: 'auto', height }}
    />
  )
}

// ─── EGO 스킬 프레임 패널 ────────────────────────────────────────────
function SkillFramePanel({
  skill, sinColor, skillIconUrl, lang,
}: {
  skill: EGOSkill
  sinColor: string
  skillIconUrl: string
  lang: SupportedLang
}) {
  const skillSin: SinType | null = (SIN_KR_TO_EN[skill.resource] ?? (skill.resource in SIN_COLORS ? skill.resource as SinType : null))
  const skillSinColor = skillSin ? (SIN_COLORS[skillSin] ?? sinColor) : sinColor

  // 코인 효과 배열 (coinNum개만)
  const coinEffects = [skill.coin1Effect, skill.coin2Effect, skill.coin3Effect, skill.coin4Effect, skill.coin5Effect]
    .slice(0, skill.coinNum)

  // 파괴 불가 코인 감지 (0-based index)
  const unbreakableCoins = new Set<number>()
  coinEffects.forEach((effect, i) => {
    if (effect && (effect.startsWith('파괴 불가 코인') || effect.startsWith('Unbreakable'))) unbreakableCoins.add(i)
  })

  // 스킬 이름 로컬라이즈
  const localName = lang === 'en' && skill.name_en
    ? skill.name_en
    : lang === 'ja' && skill.name_jp
    ? skill.name_jp
    : skill.name

  // 스킬 설명 재조립 — 언어별 효과 텍스트 선택
  const coinLabel = lang === 'ko' ? '코인' : 'Coin'
  const locCoinEffects = [
    lang === 'en' ? skill.coin1Effect_en : lang === 'ja' ? skill.coin1Effect_jp : null,
    lang === 'en' ? skill.coin2Effect_en : lang === 'ja' ? skill.coin2Effect_jp : null,
    lang === 'en' ? skill.coin3Effect_en : lang === 'ja' ? skill.coin3Effect_jp : null,
    lang === 'en' ? skill.coin4Effect_en : lang === 'ja' ? skill.coin4Effect_jp : null,
    lang === 'en' ? skill.coin5Effect_en : lang === 'ja' ? skill.coin5Effect_jp : null,
  ].slice(0, skill.coinNum)

  const normalEffectLoc =
    lang === 'en' ? (skill.normalEffect_en ?? skill.normalEffect) :
    lang === 'ja' ? (skill.normalEffect_jp ?? skill.normalEffect) :
    skill.normalEffect

  const descParts: string[] = []
  if (normalEffectLoc) descParts.push(normalEffectLoc)
  coinEffects.forEach((effect, i) => {
    const locEffect = locCoinEffects[i] ?? effect
    if (locEffect) descParts.push(`[${coinLabel} ${i + 1}] ${locEffect}`)
  })
  const fullDesc = descParts.join('\n')

  const isAttackSkill = ['slash', 'pierce', 'blunt', '참격', '관통', '타격'].includes(skill.atkType)

  return (
    <SkillFrameBlock
      skillIconUrl={skillIconUrl}
      sin={skillSin ?? 'wrath'}
      sinColor={skillSinColor}
      skillSlot={3}
      label="EGO"
      size="6.5rem"
      name={localName}
      basePower={skill.skillPower}
      coinPower={skill.coinPower}
      coins={skill.coinNum}
      atkType={skill.atkType}
      offenseLevel={skill.offenseLevel}
      atkWeight={skill.atkWeight}
      isDefense={!isAttackSkill}
      description={fullDesc || null}
      unbreakableCoins={unbreakableCoins}
      descVariant="detail"
      mentalConsume={skill.mentalConsume}
    />
  )
}

// ─── 입수 방법 로컬라이즈 ─────────────────────────────────────────────
function localizeObtainingMethod(text: string, lang: SupportedLang): string {
  if (lang === 'ko') return text

  const map: Record<string, { en: string; ja: string }> = {
    '선의의 순례': { en: 'Pilgrimage of Compassion', ja: '善意の巡礼' },
    '발푸르기스의 밤': { en: "Walpurgis Night", ja: 'ヴァルプルギスの夜' },
    '정기검진': { en: 'Regular Checkup', ja: '定期検診' },
    '특정 추출': { en: 'Targeted Extraction', ja: '特定抽出' },
    '배틀 패스': { en: 'Battle Pass', ja: 'バトルパス' },
    '자아 파편': { en: 'EGO Shard', ja: '自我の欠片' },
    '이벤트': { en: 'Event', ja: 'イベント' },
    '기본': { en: 'Default', ja: 'デフォルト' },
    '추출': { en: 'Extraction', ja: '抽出' },
    '상시': { en: 'Permanent', ja: '常時' },
    '시즌': { en: 'S', ja: 'S' },
    '이후': { en: 'onwards', ja: '以降' },
    '교환': { en: 'Exchange', ja: '交換' },
    '유료': { en: 'Paid', ja: '有料' },
    '무료': { en: 'Free', ja: '無料' },
    '레벨': { en: 'Level', ja: 'レベル' },
    '보상': { en: 'Reward', ja: '報酬' },
    '개': { en: '', ja: '個' },
  }

  let result = text
  // Replace longer phrases first to avoid partial matches
  const sorted = Object.entries(map).sort((a, b) => b[0].length - a[0].length)
  for (const [kr, trans] of sorted) {
    result = result.replaceAll(kr, trans[lang])
  }
  return result.replace(/\s+/g, ' ').trim()
}

// ─── 입수 방법 배지 ───────────────────────────────────────────────────
function EgoAcquisitionBadges({ text, fragmentLabel, lang }: { text: string; fragmentLabel: string; lang: SupportedLang }) {
  // Parse classification from Korean original; display localized text
  const parts = text.split(/\s*\/\s*/)
  const localizedParts = localizeObtainingMethod(text, lang).split(/\s*\/\s*/)

  const badges: { label: string; color: string; bg: string }[] = []
  let fragmentInfo: string | null = null

  for (let idx = 0; idx < parts.length; idx++) {
    const p = parts[idx].trim()
    const lp = (localizedParts[idx] ?? p).trim()

    if (p === '기본') {
      const label = lang === 'ko' ? '기본' : lang === 'en' ? 'Default' : 'デフォルト'
      badges.push({ label, color: '#8a8a8a', bg: 'rgba(138,138,138,0.12)' })
    } else if (/^추출\s*\(상시\)$/.test(p)) {
      const label = lang === 'ko' ? '추출(상시)' : lang === 'en' ? 'Extraction (Perm.)' : '抽出(常時)'
      badges.push({ label, color: '#6bbbff', bg: 'rgba(107,187,255,0.12)' })
    } else if (/^추출\s*\(시즌\s*(\d+)\s*이후\)$/.test(p)) {
      const m = p.match(/시즌\s*(\d+)/)
      const s = m?.[1]
      const label = lang === 'ko' ? `추출(S${s}~)` : lang === 'en' ? `Extraction (S${s}~)` : `抽出(S${s}~)`
      badges.push({ label, color: '#6bbbff', bg: 'rgba(107,187,255,0.12)' })
    } else if (/이벤트\s*추출/.test(p)) {
      const m = p.match(/시즌\s*(\d+)/)
      const label = m
        ? (lang === 'ko' ? `이벤트 추출(S${m[1]})` : lang === 'en' ? `Event Extraction (S${m[1]})` : `イベント抽出(S${m[1]})`)
        : (lang === 'ko' ? '이벤트 추출' : lang === 'en' ? 'Event Extraction' : 'イベント抽出')
      badges.push({ label, color: '#ff9f43', bg: 'rgba(255,159,67,0.12)' })
    } else if (/발푸르기스의\s*밤/.test(p)) {
      if (/추출/.test(p)) {
        const label = lang === 'ko' ? '발푸르기스 추출' : lang === 'en' ? 'Walpurgis Extraction' : 'ヴァルプルギス抽出'
        badges.push({ label, color: '#7bed9f', bg: 'rgba(123,237,159,0.12)' })
      } else {
        const m = p.match(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+/)
        const base = lang === 'ko' ? '발푸르기스' : lang === 'en' ? 'Walpurgis' : 'ヴァルプルギス'
        const label = m ? `${base} ${m[0]}` : base
        badges.push({ label, color: '#7bed9f', bg: 'rgba(123,237,159,0.12)' })
      }
    } else if (/특정\s*추출/.test(p)) {
      const m = p.match(/(.+?)\s*특정\s*추출/)
      const prefix = m ? localizeObtainingMethod(m[1].trim(), lang) : ''
      const targetedLabel = lang === 'ko' ? '특정 추출' : lang === 'en' ? 'Targeted Extraction' : '特定抽出'
      const label = prefix ? `${prefix} ${lang === 'ko' ? '특정 추출' : lang === 'en' ? 'Targeted' : '特定抽出'}` : targetedLabel
      badges.push({ label, color: '#ffa502', bg: 'rgba(255,165,2,0.12)' })
    } else if (/배틀\s*패스/.test(p)) {
      const season = p.match(/시즌\s*(\d+)/)
      const level = p.match(/(\d+)\s*레벨/)
      const paid = /유료/.test(p)
      const paidLabel = paid
        ? (lang === 'ko' ? '유료' : lang === 'en' ? 'Paid' : '有料')
        : (lang === 'ko' ? '무료' : lang === 'en' ? 'Free' : '無料')
      const passLabel = lang === 'ko' ? '패스' : lang === 'en' ? 'Pass' : 'パス'
      const label = `${paidLabel} ${passLabel}${season ? ` S${season[1]}` : ''}${level ? ` Lv.${level[1]}` : ''}`
      badges.push({ label, color: '#a29bfe', bg: 'rgba(162,155,254,0.12)' })
    } else if (/선의의\s*순례/.test(p)) {
      const pilgrimLabel = lang === 'ko' ? '선의의 순례' : lang === 'en' ? 'Pilgrimage' : '善意の巡礼'
      if (/추출/.test(p)) {
        const extractLabel = lang === 'ko' ? '추출' : lang === 'en' ? 'Extraction' : '抽出'
        badges.push({ label: `${pilgrimLabel} ${extractLabel}`, color: '#ff9f43', bg: 'rgba(255,159,67,0.12)' })
      } else {
        const rewardLabel = lang === 'ko' ? '보상' : lang === 'en' ? 'Reward' : '報酬'
        badges.push({ label: `${pilgrimLabel} ${rewardLabel}`, color: '#ff9f43', bg: 'rgba(255,159,67,0.12)' })
      }
    } else if (/이벤트.*보상|이벤트.*교환/.test(p) || /\d+개\s*(보상|획득)/.test(p)) {
      badges.push({ label: lp.replace(/\s*\/.*$/, '').trim(), color: '#ff9f43', bg: 'rgba(255,159,67,0.12)' })
    } else if (/자아\s*파편/.test(p)) {
      const cost = p.match(/(\d+)\s*(개\s*)?교환/)
      const allSeasons = [...p.matchAll(/시즌\s*(\d+)/g)].map(m => m[1])
      if (cost) {
        const shardLabel = lang === 'ko' ? '자아 파편' : lang === 'en' ? 'EGO Shard' : '自我の欠片'
        let detail = `${shardLabel} ${cost[1]}`
        if (allSeasons.length > 0) {
          detail += ` (S${allSeasons.join(', S')}~)`
        } else if (/상시/.test(p)) {
          detail += lang === 'ko' ? ' (상시)' : lang === 'en' ? ' (Perm.)' : ' (常時)'
        }
        fragmentInfo = detail
      }
    } else {
      badges.push({ label: lp, color: '#7a6a5a', bg: 'rgba(122,106,90,0.12)' })
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {badges.map((b, i) => (
          <span
            key={i}
            style={{
              fontSize: '0.625rem', fontWeight: 600,
              padding: '2px 8px', borderRadius: '3px',
              color: b.color,
              background: b.bg,
              border: `1px solid ${b.color}30`,
            }}
          >
            {b.label}
          </span>
        ))}
      </div>
      {fragmentInfo && (
        <div className="flex items-center gap-2">
          <span style={{ color: '#666', fontSize: '0.625rem', minWidth: '48px' }}>{fragmentLabel}</span>
          <span style={{ fontSize: '0.625rem', color: '#aaa' }}>{fragmentInfo}</span>
        </div>
      )}
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────
interface Props {
  sinner: Sinner
  ego: EGO
}

export default function EGODetailClient({ sinner, ego }: Props) {
  const [skillLevel, setSkillLevel] = useState<3 | 4>(4)
  const [corSkillLevel, setCorSkillLevel] = useState<3 | 4>(4)
  const keywordData = useKeywords()
  const t = useTranslations()
  const locale = useLocale()
  const lang = locale as SupportedLang

  const gradeColor = GRADE_COLORS[ego.grade] ?? '#667788'
  const sinColor = SIN_COLORS[ego.sin_affinity as SinType] ?? gradeColor

  // ego_skills가 단일 객체(JSONB)인 경우 배열로 정규화
  const normalSkillList = Array.isArray(ego.ego_skills) ? ego.ego_skills : ego.ego_skills ? [ego.ego_skills] : []
  const corSkillList = Array.isArray(ego.ego_cor_skills) ? ego.ego_cor_skills : ego.ego_cor_skills ? [ego.ego_cor_skills] : []
  const hasCor = corSkillList.length > 0

  // EGO 아이콘 URL 계산
  const egoGameId = ego.image_url?.match(/\/(\d+)_awaken_profile/)?.[1] ?? ''
  const egoFolder = ego.image_url
    ? ego.image_url.split('/ego/')[1]?.split('/')[0] ?? ''
    : ''
  const awakenIconUrl = egoGameId
    ? `${STORAGE_BASE}/sinners/${sinner.id}/ego/${egoFolder}/${egoGameId}_awaken_profile.webp`
    : ''
  const erosionIconUrl = egoGameId
    ? `${STORAGE_BASE}/sinners/${sinner.id}/ego/${egoFolder}/${egoGameId}_erosion_profile.webp`
    : ''

  // 로컬라이즈된 이름
  const egoLocalName = getLocalizedName(
    { name_kr: ego.name_kr ?? ego.name, name_en: ego.name_en, name_jp: ego.name_jp },
    lang
  )
  const sinnerLocalName = getLocalizedName(sinner, lang)

  // 이름별 그룹화 후 선택된 해석 레벨 스킬 추출
  function pickByLevel(list: EGOSkill[], level: 3 | 4): EGOSkill[] {
    const groups: Record<string, EGOSkill[]> = {}
    for (const s of list) {
      if (!groups[s.name]) groups[s.name] = []
      groups[s.name].push(s)
    }
    return Object.values(groups).map(
      group => group.find(s => s.construeLevel === level) ?? group[0]
    )
  }

  const currentSkills = pickByLevel(normalSkillList, skillLevel)
  const currentCorSkills = pickByLevel(corSkillList, corSkillLevel)

  useEffect(() => {
    let controls: Array<{ stop: () => void }> = []
    let cancelled = false
    void import('motion').then(({ animate }) => {
      if (cancelled) return
      controls = [
        animate('.ego-detail-header', { opacity: [0, 1], y: [-20, 0] }, { duration: 0.7, ease: [0.33, 1, 0.68, 1] }),
        animate('.ego-detail-content', { opacity: [0, 1], y: [20, 0] }, { duration: 0.5, delay: 0.2, ease: 'easeOut' }),
      ]
    })
    return () => {
      cancelled = true
      controls.forEach(control => control.stop())
    }
  }, [])

  return (
    <>
    <div className="min-h-screen pb-16" style={{ background: '#0d0b08' }}>

      {/* ─── 히어로 배너 ─── */}
      <div className="ego-detail-header" style={{ position: 'relative', width: '100%', aspectRatio: '16 / 5', overflow: 'hidden', background: '#080604', opacity: 0 }}>
        {ego.image_url && (
          <Image src={ego.image_url} alt="" fill quality={50}
            style={{ objectFit: 'cover', objectPosition: '50% 10%', filter: 'blur(20px) brightness(0.45)', transform: 'scale(1.1)' }}
            sizes="100vw"
          />
        )}
        {/* sin 색 그라디언트 오버레이 */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, rgba(8,6,4,0.75) 0%, ${sinColor}12 50%, rgba(8,6,4,0.7) 100%)` }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', background: 'linear-gradient(to bottom, transparent, #0d0b08)' }} />
        {/* 장식 라인 */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '0.0625rem', background: `linear-gradient(90deg, transparent, ${sinColor}40, transparent)` }} />
        <div style={{ position: 'absolute', bottom: '1.75rem', left: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.375rem' }}>
          <GradeImg grade={ego.grade} height={20} />
          <h1 className="font-serif" style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e8b030', lineHeight: 1.1, textShadow: `0 0 2.5rem ${sinColor}60` }} suppressHydrationWarning>
            {egoLocalName}
          </h1>
          {ego.name_kr && (
            <p className="font-mono" style={{ fontSize: '0.8125rem', color: '#8a6010', letterSpacing: '0.08em' }} suppressHydrationWarning>{ego.name}</p>
          )}
        </div>
      </div>

      {/* ─── 메인 ─── */}
      <div className="ego-detail-content max-w-6xl mx-auto px-6 pt-8" style={{ opacity: 0 }}>

        {/* 브레드크럼 */}
        <div className="mb-8 flex items-center gap-2 text-sm" style={{ color: '#888888' }}>
          <Link href="/sinners" className="hover:text-yellow-300 transition-colors" suppressHydrationWarning>{t('nav.sinnerList')}</Link>
          <span style={{ color: '#333344' }}>&rsaquo;</span>
          <Link href={`/sinners/${sinner.id}`} className="hover:text-yellow-300 transition-colors" suppressHydrationWarning>{sinnerLocalName}</Link>
          <span style={{ color: '#333344' }}>&rsaquo;</span>
          <span style={{ color: sinColor }} suppressHydrationWarning>{egoLocalName}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ─── 좌측 사이드바 (sticky) ─── */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-5">

            {/* 원형 이미지 */}
            <div className="flex flex-col items-center gap-4">
              <div style={{
                position: 'relative', width: '10rem', height: '10rem', borderRadius: '50%', overflow: 'hidden',
                border: `3px solid ${sinColor}`, background: '#0d0a06',
                boxShadow: `0 0 0 1px ${sinColor}28, 0 0 2.5rem ${sinColor}40, 0 0 5rem ${sinColor}18`,
              }}>
                {ego.image_url ? (
                  <Image src={ego.image_url} alt={egoLocalName} fill className="object-cover" style={{ objectPosition: '50% 10%' }} sizes="10rem" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-mono text-3xl" style={{ color: gradeColor }}>{ego.grade?.[0]}</span>
                  </div>
                )}
              </div>

              {/* Grade + Sin 배지 */}
              <div className="flex items-center gap-2" style={{ padding: '0.3125rem 0.875rem', background: `${gradeColor}12`, border: `1px solid ${gradeColor}35`, borderRadius: '0.25rem' }}>
                <GradeImg grade={ego.grade} height={20} />
                {ego.sin_affinity && (
                  <Image src={getSinIconUrl(ego.sin_affinity as SinType)} alt="" width={20} height={20}
                    style={{ opacity: 0.75, marginLeft: '6px', width: '1.25rem', height: '1.25rem' }} />
                )}
              </div>
            </div>

            {/* 기본 정보 카드 */}
            <div className="card p-4 space-y-4" style={{
              background: 'linear-gradient(180deg, #14120e 0%, #0f0d0a 100%)',
              border: `0.0625rem solid ${sinColor}18`,
              borderRadius: '0.5rem',
              boxShadow: `0 0.75rem 2.5rem rgba(0,0,0,0.35), 0 0 1.5rem ${sinColor}08`,
            }}>
              {/* 죄악 내성 */}
              {ego.resistance && ego.resistance.length === 7 && (
                <div>
                  <p style={{ color: '#666', fontSize: '0.625rem', marginBottom: '0.5rem', letterSpacing: '0.1em' }} suppressHydrationWarning>{t('ego.sinResistance')}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {SIN_ORDER.map((sin, i) => {
                      const res = ego.resistance![i] ?? '보통'
                      const rs = RESISTANCE_STYLE[res] ?? RESISTANCE_STYLE['보통']
                      const sc = SIN_COLORS[sin]
                      const resKey = RES_KEY_MAP[res]
                      return (
                        <div key={sin} className="flex items-center gap-1.5">
                          <Image src={getSinIconUrl(sin)} alt="" width={18} height={18}
                            style={{ filter: `drop-shadow(0 0 0.125rem ${sc}60)`, flexShrink: 0, width: '1.125rem', height: '1.125rem' }} />
                          <span className="font-mono" style={{ fontSize: '0.625rem', color: rs.color, fontWeight: 600 }}>
                            {resKey ? t(resKey as Parameters<typeof t>[0]) : res}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 코스트 */}
              {ego.cost && ego.cost.some(c => c > 0) && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <p style={{ color: '#666', fontSize: '0.625rem', marginBottom: '0.5rem', letterSpacing: '0.1em' }} suppressHydrationWarning>{t('ego.cost')}</p>
                  <div className="flex flex-wrap gap-2">
                    {SIN_ORDER.map((sin, i) => {
                      const amount = ego.cost![i]
                      if (!amount) return null
                      const sc = SIN_COLORS[sin]
                      return (
                        <div key={sin} className="flex items-center gap-1.5"
                          style={{ padding: '0.25rem 0.625rem', background: `${sc}12`, border: `1px solid ${sc}40`, borderRadius: '0.25rem' }}>
                          <Image src={getSinIconUrl(sin)} alt="" width={18} height={18}
                            style={{ filter: `drop-shadow(0 0 0.1875rem ${sc}60)`, width: '1.125rem', height: '1.125rem' }} />
                          <span className="font-mono font-bold" style={{ fontSize: '0.75rem', color: sc }}>{amount}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 입수 방법 */}
              {ego.obtaining_method && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <p style={{ color: '#666', fontSize: '0.625rem', marginBottom: '0.375rem', letterSpacing: '0.1em' }} suppressHydrationWarning>{t('ego.acquisition')}</p>
                  <EgoAcquisitionBadges text={ego.obtaining_method} fragmentLabel={t('ego.fragmentExchange')} lang={lang} />
                </div>
              )}
            </div>

            {/* 뒤로가기 */}
            <Link
              href={`/sinners/${sinner.id}#ego`}
              className="block text-center py-3 font-medium text-sm transition-all duration-300"
              style={{
                background: `linear-gradient(135deg, ${sinColor}08 0%, ${sinColor}03 100%)`,
                border: `0.0625rem solid ${sinColor}20`,
                borderRadius: '0.375rem',
                color: 'var(--gold-dim)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${sinColor}45`
                e.currentTarget.style.background = `linear-gradient(135deg, ${sinColor}12 0%, ${sinColor}06 100%)`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = `${sinColor}20`
                e.currentTarget.style.background = `linear-gradient(135deg, ${sinColor}08 0%, ${sinColor}03 100%)`
              }}
            >
              &larr; <span suppressHydrationWarning>{t('ego.backToEgoList')}</span>
            </Link>
          </div>

          {/* ─── 우측 메인 ─── */}
          <div className="lg:col-span-2 space-y-6">

            {/* 패시브 */}
            {(ego.passive_name || ego.passive_name_en || ego.passive_name_jp) && (
              <div className="card p-6" style={{
                background: 'linear-gradient(180deg, #14120e 0%, #0f0d0a 100%)',
                border: `0.0625rem solid ${sinColor}18`,
                borderRadius: '0.5rem',
                boxShadow: `0 0.75rem 2.5rem rgba(0,0,0,0.35), 0 0 1.5rem ${sinColor}08`,
              }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1" style={{ height: '1px', background: `linear-gradient(90deg, transparent 0%, ${sinColor}40 100%)` }} />
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em',
                    color: sinColor, fontFamily: 'var(--font-heading)',
                    textShadow: `0 0 0.75rem ${sinColor}30`,
                  }}>
                    <span suppressHydrationWarning>{t('ego.passive')}</span>
                  </span>
                  <div className="flex-1" style={{ height: '1px', background: `linear-gradient(90deg, ${sinColor}40 0%, transparent 100%)` }} />
                </div>
                <div className="p-4 rounded" style={{ background: `${sinColor}06`, border: `1px solid ${sinColor}20` }}>
                  {/* 패시브 이름 — 사선 꼬리 배너 */}
                  <div className="overflow-hidden mb-2" style={{ width: 'fit-content', maxWidth: '100%' }}>
                    <div style={{
                      color: '#e8dcc8',
                      backgroundImage: `linear-gradient(255deg, transparent 1.2em, ${sinColor}30 1.2em)`,
                    }}>
                      <div style={{
                        padding: '0.1em 0 0.1em 0.3em',
                        backgroundImage: `linear-gradient(290deg, transparent 2em, ${sinColor}40 2em, ${sinColor}40 2.12em, transparent 2.12em, transparent 2.24em, ${sinColor}40 2.24em, ${sinColor}40 2.36em, transparent 2.36em, transparent 2.48em, ${sinColor}40 2.48em, ${sinColor}40 2.6em, transparent 2.6em, transparent 2.72em, ${sinColor}40 2.72em)`,
                        textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
                      }}>
                        <span className="font-bold whitespace-nowrap" style={{
                          fontSize: '0.8125rem',
                          fontFamily: 'var(--font-heading)',
                          fontWeight: 800,
                          paddingRight: '3.5em',
                          color: '#e8dcc8',
                        }} suppressHydrationWarning>
                          {lang === 'en' && ego.passive_name_en ? ego.passive_name_en
                            : lang === 'ja' && ego.passive_name_jp ? ego.passive_name_jp
                            : ego.passive_name}
                        </span>
                      </div>
                    </div>
                  </div>
                  {(ego.passive_content || ego.passive_content_en || ego.passive_content_jp) && (
                    <SkillDescription
                      description={
                        lang === 'en' && ego.passive_content_en ? ego.passive_content_en
                          : lang === 'ja' && ego.passive_content_jp ? ego.passive_content_jp
                          : ego.passive_content ?? ''
                      }
                      accentColor={sinColor}
                      variant="detail"
                    />
                  )}
                </div>
              </div>
            )}

            {/* EGO 스킬 (일반) */}
            {normalSkillList.length > 0 && (
              <div className="card p-6" style={{
                background: 'linear-gradient(180deg, #14120e 0%, #0f0d0a 100%)',
                border: `0.0625rem solid ${sinColor}18`,
                borderRadius: '0.5rem',
                boxShadow: `0 0.75rem 2.5rem rgba(0,0,0,0.35), 0 0 1.5rem ${sinColor}08`,
              }}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="font-serif font-light" style={{ color: 'var(--gold)', fontSize: '1rem' }}>{t('ego.egoSkill')}</h2>
                  {/* 3해석 / 4해석 */}
                  <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {([3, 4] as const).map(lv => (
                      <button
                        key={lv}
                        onClick={() => setSkillLevel(lv)}
                        className="px-3 py-1.5 text-xs font-semibold transition-all"
                        style={{
                          background: skillLevel === lv ? `${sinColor}20` : 'transparent',
                          color: skillLevel === lv ? sinColor : '#444',
                          borderRight: lv === 3 ? '1px solid var(--border)' : undefined,
                        }}
                      >
                        {lv} {t('ego.construeLevel')}
                      </button>
                    ))}
                  </div>
                </div>
                {currentSkills.length > 0 ? (
                  <div className="space-y-6">
                    {currentSkills.map((skill, i) => (
                      <SkillFramePanel
                        key={i}
                        skill={skill}
                        sinColor={sinColor}
                        skillIconUrl={awakenIconUrl}
                        lang={lang}
                      />
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#444', fontSize: '0.8125rem', fontStyle: 'italic' }}>{t('ego.noSkillData')}</p>
                )}
              </div>
            )}

            {/* EGO 침식 스킬 */}
            {hasCor && (
              <div
                className="rounded-lg overflow-hidden"
                style={{
                  position: 'relative',
                  border: '1px solid rgba(180,20,20,0.5)',
                  boxShadow: '0 0 2.5rem rgba(160,10,10,0.18), inset 0 0 3.75rem rgba(120,0,0,0.08)',
                  background: 'rgba(20,4,4,0.85)',
                }}
              >
                {/* 침식 헤더 */}
                <div style={{
                  padding: '0.875rem 1.5rem',
                  borderBottom: '1px solid rgba(180,20,20,0.35)',
                  background: 'linear-gradient(90deg, rgba(120,0,0,0.4) 0%, rgba(20,4,4,0.0) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}>
                  <span className="font-mono font-bold" style={{
                    fontSize: '0.6875rem',
                    color: '#cc2222',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    textShadow: '0 0 0.75rem rgba(200,20,20,0.6)',
                  }}>
                    ▌ {t('ego.corrosionSection')}
                  </span>
                  {/* 3해석 / 4해석 */}
                  <div className="flex rounded overflow-hidden" style={{ border: '1px solid rgba(180,20,20,0.4)' }}>
                    {([3, 4] as const).map(lv => (
                      <button
                        key={lv}
                        onClick={() => setCorSkillLevel(lv)}
                        className="px-3 py-1.5 text-xs font-semibold transition-all"
                        style={{
                          background: corSkillLevel === lv ? 'rgba(180,20,20,0.3)' : 'transparent',
                          color: corSkillLevel === lv ? '#dd4444' : 'rgba(180,60,60,0.4)',
                          borderRight: lv === 3 ? '1px solid rgba(180,20,20,0.4)' : undefined,
                        }}
                      >
                        {lv} {t('ego.construeLevel')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 침식 스킬 */}
                <div className="p-6 space-y-6">
                  {currentCorSkills.length > 0 ? (
                    currentCorSkills.map((skill, i) => (
                      <SkillFramePanel
                        key={i}
                        skill={skill}
                        sinColor={sinColor}
                        skillIconUrl={erosionIconUrl}
                        lang={lang}
                      />
                    ))
                  ) : (
                    <p style={{ color: '#442222', fontSize: '0.8125rem', fontStyle: 'italic' }}>{t('ego.noCorSkillData')}</p>
                  )}
                </div>

              </div>
            )}

            {/* 키워드 */}
            {ego.keywords && ego.keywords.length > 0 && (
              <div className="card p-6" style={{
                background: 'linear-gradient(180deg, #14120e 0%, #0f0d0a 100%)',
                border: `0.0625rem solid ${sinColor}18`,
                borderRadius: '0.5rem',
                boxShadow: `0 0.75rem 2.5rem rgba(0,0,0,0.35), 0 0 1.5rem ${sinColor}08`,
              }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1" style={{ height: '1px', background: `linear-gradient(90deg, transparent 0%, ${sinColor}40 100%)` }} />
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em',
                    color: sinColor, fontFamily: 'var(--font-heading)',
                    textShadow: `0 0 0.75rem ${sinColor}30`,
                  }}>
                    {t('ego.keyword')}
                  </span>
                  <div className="flex-1" style={{ height: '1px', background: `linear-gradient(90deg, ${sinColor}40 0%, transparent 100%)` }} />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-2">
                  {ego.keywords.map((kw, i) => {
                    const info = keywordData[kw]
                    const iconUrl = getKeywordIconUrl(kw, info?.iconSlug)
                    const kwColor = getGiftKeywordColor(kw) !== '#888888'
                      ? getGiftKeywordColor(kw)
                      : (info?.sinAffinity ? SIN_COLORS[info.sinAffinity as SinType] ?? '#999' : '#999')
                    return (
                      <span key={i} className="inline-flex items-center gap-1.5" style={{ color: kwColor }}>
                        {iconUrl && (
                          <Image src={iconUrl} alt="" width={16} height={16} style={{ width: '1rem', height: '1rem', objectFit: 'contain' }} />
                        )}
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                          {getLocalizedKeywordName(kw, info ? { nameEn: info.nameEn, nameJp: info.nameJp, descEn: null, descJp: null } : undefined, lang)}
                        </span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
    </>
  )
}

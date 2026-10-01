'use client'

import { getEgoGradeBannerUrl, getEgoArtworkUrl } from '@/lib/utils/images'

import { useState } from 'react'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import {
  Sinner, EGO, EGOSkill, STORAGE_BASE,
  SIN_COLORS, SinType,
  GRADE_COLORS, SIN_KR_TO_EN,
  getSinIconUrl,
  SIN_ORDER,
} from '@/lib/data/sinners'
import EgoStageTabs from '@/components/ego/EgoStageTabs'
import { egoStages, egoSkillsAtStage, egoPassiveAtStage } from '@/lib/ego/stages'
import SkillFrameBlock from '@/components/identity/SkillFrameBlock'
import SkillDescription from '@/components/skill/SkillDescription'
import { isUnbreakableCoinText } from '@/lib/identity/skill-description'
import { useKeywords } from '@/components/providers/KeywordProvider'
import { getLocalizedName, getLocalizedKeywordName } from '@/lib/i18n'
import { useTranslations, useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { KeywordWithTooltip } from '@/components/sinners/KeywordTooltip'
import styles from './EGODetail.module.css'

// ─── 상수 ────────────────────────────────────────────────────────────
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
  return (
    <Image
      src={getEgoGradeBannerUrl(grade)}
      alt={grade}
      width={40}
      height={height}
      unoptimized
      style={{ width: 'auto', height }}
    />
  )
}

function getLocalizedObtainingMethod(ego: EGO, lang: SupportedLang) {
  if (lang === 'en') return ego.obtaining_method_en ?? ego.obtaining_method
  if (lang === 'ja') return ego.obtaining_method_jp ?? ego.obtaining_method
  return ego.obtaining_method
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
    if (isUnbreakableCoinText(effect)) unbreakableCoins.add(i)
  })

  // 스킬 이름 로컬라이즈
  const localName = lang === 'en' && skill.name_en
    ? skill.name_en
    : lang === 'ja' && skill.name_jp
    ? skill.name_jp
    : skill.name

  // 스킬 설명 재조립 — 언어별 효과 텍스트 선택
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
    // A <coin=N> block, not a "[코인 N]" line: a tag the main text leaves open must not run on into the coin, and a coin's
    // lines stay together. The description reader (SkillDescription) draws the coin label for the page language.
    if (locEffect) descParts.push(`<coin=${i + 1}>${locEffect}</coin>`)
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
      badges.push({ label, color: '#9c8b73', bg: 'rgba(156,139,115,0.12)' })
    } else if (/^추출\s*\(상시\)$/.test(p)) {
      const label = lang === 'ko' ? '추출(상시)' : lang === 'en' ? 'Extraction (Perm.)' : '抽出(常時)'
      badges.push({ label, color: '#e8dcc8', bg: 'rgba(232,220,200,0.12)' })
    } else if (/^추출\s*\(시즌\s*(\d+)\s*이후\)$/.test(p)) {
      const m = p.match(/시즌\s*(\d+)/)
      const s = m?.[1]
      const label = lang === 'ko' ? `추출(S${s}~)` : lang === 'en' ? `Extraction (S${s}~)` : `抽出(S${s}~)`
      badges.push({ label, color: '#e8dcc8', bg: 'rgba(232,220,200,0.12)' })
    } else if (/이벤트\s*추출/.test(p)) {
      const m = p.match(/시즌\s*(\d+)/)
      const label = m
        ? (lang === 'ko' ? `이벤트 추출(S${m[1]})` : lang === 'en' ? `Event Extraction (S${m[1]})` : `イベント抽出(S${m[1]})`)
        : (lang === 'ko' ? '이벤트 추출' : lang === 'en' ? 'Event Extraction' : 'イベント抽出')
      badges.push({ label, color: '#e8b030', bg: 'rgba(232,176,48,0.12)' })
    } else if (/발푸르기스의\s*밤/.test(p)) {
      if (/추출/.test(p)) {
        const label = lang === 'ko' ? '발푸르기스 추출' : lang === 'en' ? 'Walpurgis Extraction' : 'ヴァルプルギス抽出'
        badges.push({ label, color: '#d9826b', bg: 'rgba(217,130,107,0.12)' })
      } else {
        const m = p.match(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+/)
        const base = lang === 'ko' ? '발푸르기스' : lang === 'en' ? 'Walpurgis' : 'ヴァルプルギス'
        const label = m ? `${base} ${m[0]}` : base
        badges.push({ label, color: '#d9826b', bg: 'rgba(217,130,107,0.12)' })
      }
    } else if (/특정\s*추출/.test(p)) {
      const m = p.match(/(.+?)\s*특정\s*추출/)
      const prefix = m ? localizeObtainingMethod(m[1].trim(), lang) : ''
      const targetedLabel = lang === 'ko' ? '특정 추출' : lang === 'en' ? 'Targeted Extraction' : '特定抽出'
      const label = prefix ? `${prefix} ${lang === 'ko' ? '특정 추출' : lang === 'en' ? 'Targeted' : '特定抽出'}` : targetedLabel
      badges.push({ label, color: '#e8b030', bg: 'rgba(232,176,48,0.12)' })
    } else if (/배틀\s*패스/.test(p)) {
      const season = p.match(/시즌\s*(\d+)/)
      const level = p.match(/(\d+)\s*레벨/)
      const paid = /유료/.test(p)
      const paidLabel = paid
        ? (lang === 'ko' ? '유료' : lang === 'en' ? 'Paid' : '有料')
        : (lang === 'ko' ? '무료' : lang === 'en' ? 'Free' : '無料')
      const passLabel = lang === 'ko' ? '패스' : lang === 'en' ? 'Pass' : 'パス'
      const label = `${paidLabel} ${passLabel}${season ? ` S${season[1]}` : ''}${level ? ` Lv.${level[1]}` : ''}`
      badges.push({ label, color: '#b8a684', bg: 'rgba(184,166,132,0.12)' })
    } else if (/선의의\s*순례/.test(p)) {
      const pilgrimLabel = lang === 'ko' ? '선의의 순례' : lang === 'en' ? 'Pilgrimage' : '善意の巡礼'
      if (/추출/.test(p)) {
        const extractLabel = lang === 'ko' ? '추출' : lang === 'en' ? 'Extraction' : '抽出'
        badges.push({ label: `${pilgrimLabel} ${extractLabel}`, color: '#e8b030', bg: 'rgba(232,176,48,0.12)' })
      } else {
        const rewardLabel = lang === 'ko' ? '보상' : lang === 'en' ? 'Reward' : '報酬'
        badges.push({ label: `${pilgrimLabel} ${rewardLabel}`, color: '#e8b030', bg: 'rgba(232,176,48,0.12)' })
      }
    } else if (/이벤트.*보상|이벤트.*교환/.test(p) || /\d+개\s*(보상|획득)/.test(p)) {
      badges.push({ label: lp.replace(/\s*\/.*$/, '').trim(), color: '#e8b030', bg: 'rgba(232,176,48,0.12)' })
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
              fontSize: '0.75rem', fontWeight: 600,
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
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '3rem' }}>{fragmentLabel}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{fragmentInfo}</span>
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
  const normalSkillList = ego.ego_skills ?? []
  const corSkillList = ego.ego_cor_skills ?? []
  const normalStages = egoStages(normalSkillList)
  const corrosionStages = egoStages(corSkillList)
  const [normalSelection, setSkillLevel] = useState(() => normalStages.at(-1) ?? 1)
  const [corrosionSelection, setCorSkillLevel] = useState(() => corrosionStages.at(-1) ?? 1)
  const skillLevel = normalStages.includes(normalSelection) ? normalSelection : normalStages.at(-1) ?? 1
  const corSkillLevel = corrosionStages.includes(corrosionSelection) ? corrosionSelection : corrosionStages.at(-1) ?? 1
  const passive = egoPassiveAtStage(ego, skillLevel)
  const keywordData = useKeywords()
  const t = useTranslations()
  const locale = useLocale()
  const lang = locale as SupportedLang
  const obtainingMethod = getLocalizedObtainingMethod(ego, lang)

  const gradeColor = GRADE_COLORS[ego.grade] ?? '#667788'
  const sinColor = SIN_COLORS[ego.sin_affinity as SinType] ?? gradeColor

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

  const currentSkills = egoSkillsAtStage(normalSkillList, skillLevel)
  const currentCorSkills = egoSkillsAtStage(corSkillList, corSkillLevel)

  const passiveName = lang === 'en' ? passive.passive_name_en || passive.passive_name
    : lang === 'ja' ? passive.passive_name_jp || passive.passive_name : passive.passive_name
  const passiveDescription = lang === 'en' ? passive.passive_content_en || passive.passive_content
    : lang === 'ja' ? passive.passive_content_jp || passive.passive_content : passive.passive_content

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label={t('nav.sinnerList')}>
        <Link href="/sinners">{t('nav.sinnerList')}</Link><span aria-hidden="true">›</span>
        <Link href={`/sinners/${sinner.id}`}>{sinnerLocalName}</Link><span aria-hidden="true">›</span>
        <span>{egoLocalName}</span>
      </nav>

      <div className={styles.hero}>
        <section className={styles.portrait} aria-labelledby="ego-title">
          <div className={styles.titleRow}>
            <div><h1 id="ego-title">{egoLocalName}</h1><Link href={`/sinners/${sinner.id}`}>{sinnerLocalName}</Link></div>
            <GradeImg grade={ego.grade} height={28} />
          </div>
          <div className={styles.artwork}>
            {ego.image_url ? <Image src={getEgoArtworkUrl(ego.image_url, ego.artwork_url)} alt={egoLocalName} fill priority sizes="(max-width: 767px) 85vw, 32rem" className={styles.artworkImage} />
              : <span className={styles.artworkFallback}>{ego.grade}</span>}
          </div>
          <Link href={`/sinners/${sinner.id}#ego`} className={styles.backLink}>← {t('ego.backToEgoList')}</Link>
        </section>

        <section className={styles.info} aria-labelledby="ego-info-title">
          <header className={styles.sectionHeading}>
            <h2 id="ego-info-title">{t('identity.info.title')}</h2>
            {ego.sin_affinity && <Image src={getSinIconUrl(ego.sin_affinity as SinType)} alt={t(`sin.${ego.sin_affinity}` as Parameters<typeof t>[0])} width={28} height={28} />}
          </header>
          {ego.keywords && ego.keywords.length > 0 && <div className={styles.infoRow}>
            <h3>{t('identity.info.combatKeywords')}</h3>
            <div className={styles.keywords}>{[...new Set(ego.keywords)].map(kw => (
              <div className={styles.keyword} key={kw}><KeywordWithTooltip keyword={kw}>
                <span>{getLocalizedKeywordName(kw, keywordData[kw], lang)}</span>
              </KeywordWithTooltip></div>
            ))}</div>
          </div>}
          {ego.cost && ego.cost.some(amount => amount > 0) && <div className={styles.infoRow}>
            <h3>{t('ego.cost')}</h3>
            <div className={styles.costs}>{SIN_ORDER.map((sin, index) => {
              const amount = ego.cost![index]
              return amount > 0 ? <div key={sin} className={styles.cost}>
                <Image src={getSinIconUrl(sin)} alt={t(`sin.${sin}` as Parameters<typeof t>[0])} width={28} height={28} />
                <span>{amount}</span>
              </div> : null
            })}</div>
          </div>}
          {ego.resistance?.length === 7 && <div className={styles.infoRow}>
            <h3>{t('ego.sinResistance')}</h3>
            <div className={styles.resistances}>{SIN_ORDER.map((sin, index) => {
              const resistance = ego.resistance![index] ?? '보통'
              const key = RES_KEY_MAP[resistance]
              return <div key={sin} className={styles.resistance} data-resistance={resistance}>
                <Image src={getSinIconUrl(sin)} alt={t(`sin.${sin}` as Parameters<typeof t>[0])} width={26} height={26} />
                <span>{key ? t(key as Parameters<typeof t>[0]) : resistance}</span>
              </div>
            })}</div>
          </div>}
          {obtainingMethod && <div className={styles.infoRow}>
            <h3>{t('ego.acquisition')}</h3>
            <EgoAcquisitionBadges text={obtainingMethod} fragmentLabel={t('ego.fragmentExchange')} lang={lang} />
          </div>}
        </section>
      </div>

      <div className={styles.combat}>
        {normalSkillList.length > 0 && <section className={styles.skillSection} aria-labelledby="ego-awakening">
          <header className={styles.sectionHeading}>
            <h2 id="ego-awakening">{t('ego.awakening')}</h2>
            <div className={styles.stageControl}><span>{t('ego.construeLevel')}</span>
              <EgoStageTabs levels={normalStages} value={skillLevel} onChange={setSkillLevel} label={t('ego.construeLevel')} color="#c8900a" />
            </div>
          </header>
          <div className={styles.skillList}>{currentSkills.length ? currentSkills.map((skill, index) => (
            <div className={styles.skill} key={`${skill.gameSkillId ?? skill.name}-${index}`}>
              <SkillFramePanel skill={skill} sinColor={sinColor} skillIconUrl={awakenIconUrl} lang={lang} />
            </div>
          )) : <p className={styles.empty}>{t('ego.noSkillData')}</p>}</div>
        </section>}

        {hasCor && <section className={styles.skillSection} aria-labelledby="ego-corrosion">
          <header className={styles.sectionHeading}>
            <h2 id="ego-corrosion">{t('ego.corrosionSection')}</h2>
            <div className={styles.stageControl}><span>{t('ego.construeLevel')}</span>
              <EgoStageTabs levels={corrosionStages} value={corSkillLevel} onChange={setCorSkillLevel} label={t('ego.construeLevel')} color="#c8900a" />
            </div>
          </header>
          <div className={styles.skillList}>{currentCorSkills.length ? currentCorSkills.map((skill, index) => (
            <div className={styles.skill} key={`${skill.gameSkillId ?? skill.name}-${index}`}>
              <SkillFramePanel skill={skill} sinColor={sinColor} skillIconUrl={erosionIconUrl} lang={lang} />
            </div>
          )) : <p className={styles.empty}>{t('ego.noCorSkillData')}</p>}</div>
        </section>}

        {passiveName && <section className={styles.passive} aria-labelledby="ego-passive">
          <header className={styles.sectionHeading}><h2 id="ego-passive">{t('ego.passive')}</h2></header>
          <div className={styles.passiveContent}>
            <h3>{passiveName}</h3>
            {passiveDescription && <SkillDescription description={passiveDescription} accentColor="#c8900a" variant="detail" />}
          </div>
        </section>}
      </div>
    </div>
  )
}

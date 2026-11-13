'use client'

import AdSlot from '@/components/ads/AdSlot'
import { getEgoGradeBannerUrl, getEgoArtworkUrl } from '@/lib/utils/images'

import { useMemo, useState } from 'react'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import {
  Sinner, EGO, EGOSkill, STORAGE_BASE,
  SIN_COLORS, SinType,
  GRADE_COLORS, SIN_KR_TO_EN,
  getSinIconUrl,
  SIN_ORDER,
} from '@/lib/data/sinners'
import EgoStageTabs from '@/features/catalog/components/EgoStageTabs'
import { egoStages, egoSkillsAtStage, egoPassiveAtStage } from '../lib/ego-stages'
import SkillFrameBlock from '@/features/catalog/components/SkillFrameBlock'
import SkillDescription from '@/features/catalog/components/SkillDescription'
import { isUnbreakableCoinText } from '@/lib/identity/skill-description'
import { KeywordWithTooltip, useKeywords } from '@/components/providers/KeywordProvider'
import { useOwnKeywords } from '@/lib/hooks/useOwnKeywords'
import { egoTexts } from '@/lib/keywords/own-keywords'
import { getLocalizedName, getLocalizedKeywordName } from '@/lib/i18n'
import { useTranslations, useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import styles from './EgoDetailView.module.css'
import { MultipliedCount, PassiveNameLabel } from '@/features/catalog/components/PassiveParts'
import portraitStyles from '@/styles/components/SinnerDetail.module.css'

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

// ─── EGO 스킬 프레임 패널 ────────────────────────────────────────────
function SkillFramePanel({
  skill, sinColor, skillIconUrl, lang, allowedKeywords,
}: {
  skill: EGOSkill
  sinColor: string
  skillIconUrl: string
  lang: SupportedLang
  allowedKeywords: ReadonlySet<string>
}) {
  const skillSin: SinType | null = (SIN_KR_TO_EN[skill.resource] ?? (skill.resource in SIN_COLORS ? skill.resource as SinType : null))
  const skillSinColor = skillSin ? (SIN_COLORS[skillSin] ?? sinColor) : sinColor

  // 코인 효과 배열 (coinNum개만)
  const coinEffects = (skill.coinEffects ?? [skill.coin1Effect, skill.coin2Effect, skill.coin3Effect, skill.coin4Effect, skill.coin5Effect])
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
  const locCoinEffects = ((lang === 'en' ? skill.coinEffects_en : lang === 'ja' ? skill.coinEffects_jp : null) ?? [
    lang === 'en' ? skill.coin1Effect_en : lang === 'ja' ? skill.coin1Effect_jp : null,
    lang === 'en' ? skill.coin2Effect_en : lang === 'ja' ? skill.coin2Effect_jp : null,
    lang === 'en' ? skill.coin3Effect_en : lang === 'ja' ? skill.coin3Effect_jp : null,
    lang === 'en' ? skill.coin4Effect_en : lang === 'ja' ? skill.coin4Effect_jp : null,
    lang === 'en' ? skill.coin5Effect_en : lang === 'ja' ? skill.coin5Effect_jp : null,
  ]).slice(0, skill.coinNum)

  const normalEffectLoc =
    lang === 'en' ? (skill.normalEffect_en ?? skill.normalEffect) :
    lang === 'ja' ? (skill.normalEffect_jp ?? skill.normalEffect) :
    skill.normalEffect

  const descParts: string[] = []
  if (normalEffectLoc) descParts.push(normalEffectLoc)
  coinEffects.forEach((effect, i) => {
    const locEffect = locCoinEffects[i] || effect
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
      size="8.125rem"
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
      allowedKeywords={allowedKeywords}
      matchPlainKeywords
    />
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────
interface Props {
  sinner: Sinner
  ego: EGO
  /** Inside a window (EgoDetailModal): no breadcrumb, back link or ad, and no page padding. */
  embedded?: boolean
}

/** The E.G.O detail: art, info, skills by stage, passive. The E.G.O page and the E.G.O info window both show this. */
export default function EgoDetailView({ sinner, ego, embedded = false }: Props) {
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
  // The keywords of this E.G.O (its keyword list and what its own skills and passives reference): plain words of older text are searched among these.
  const ownTexts = useMemo(() => egoTexts(ego), [ego])
  const allowedKeywords = useOwnKeywords(ego.keywords, ownTexts)
  const t = useTranslations()
  const locale = useLocale()
  const lang = locale as SupportedLang

  const gradeColor = GRADE_COLORS[ego.grade] ?? '#667788'
  const sinColor = SIN_COLORS[ego.sin_affinity as SinType] ?? gradeColor

  const hasCor = corSkillList.length > 0
  const corrosionArtwork = ego.corrosion_artwork_url?.trim() || null
  const [heroArt, setHeroArt] = useState<'awakening' | 'corrosion'>('awakening')

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
    { name_kr: ego.name_kr, name_en: ego.name_en, name_jp: ego.name_jp },
    lang
  )
  const sinnerLocalName = getLocalizedName(sinner, lang)

  const currentSkills = egoSkillsAtStage(normalSkillList, skillLevel)
  const currentCorSkills = egoSkillsAtStage(corSkillList, corSkillLevel)

  const passiveName = lang === 'en' ? passive.passive_name_en || passive.passive_name
    : lang === 'ja' ? passive.passive_name_jp || passive.passive_name : passive.passive_name
  const passiveDescription = lang === 'en' ? passive.passive_content_en || passive.passive_content
    : lang === 'ja' ? passive.passive_content_jp || passive.passive_content : passive.passive_content
  const stageFlavor = 'passive_flavor' in passive ? passive : null
  const passiveFlavor = stageFlavor && (lang === 'en' ? stageFlavor.passive_flavor_en : lang === 'ja' ? stageFlavor.passive_flavor_jp : stageFlavor.passive_flavor)

  return (
    <div className={embedded ? `${styles.page} ${styles.embedded}` : styles.page}>
      {!embedded && <nav className={styles.breadcrumb} aria-label={t('nav.sinnerList')}>
        <Link href="/sinners">{t('nav.sinnerList')}</Link><span aria-hidden="true">›</span>
        <Link href={`/sinners/${sinner.id}`}>{sinnerLocalName}</Link><span aria-hidden="true">›</span>
        <span>{egoLocalName}</span>
      </nav>}

      <div className={styles.hero}>
        <section className={styles.portrait} aria-labelledby="ego-title">
          <div className={styles.titleRow}>
            <div><h1 id="ego-title">{egoLocalName}</h1><Link href={`/sinners/${sinner.id}`}>{sinnerLocalName}</Link></div>
            <GradeImg grade={ego.grade} height={28} />
          </div>
          {corrosionArtwork && <div className={`${portraitStyles.segment} ${portraitStyles.segmentFill} ${styles.artworkTabs}`} role="group" aria-label={egoLocalName}>
            <button type="button" aria-pressed={heroArt === 'awakening'} onClick={() => setHeroArt('awakening')}>
              {awakenIconUrl && <img src={awakenIconUrl} alt="" />}{t('ego.awakeningLabel')}
            </button>
            <button type="button" aria-pressed={heroArt === 'corrosion'} onClick={() => setHeroArt('corrosion')}>
              {erosionIconUrl && <img src={erosionIconUrl} alt="" />}{t('ego.corrosionLabel')}
            </button>
          </div>}
          <div className={styles.artwork}>
            {/* Both arts stay mounted (the second loads in the background): switching only fades, nothing reflows. */}
            {ego.image_url ? <Image src={getEgoArtworkUrl(ego.image_url, ego.artwork_url)} alt={egoLocalName} fill priority sizes="(max-width: 767px) 85vw, 32rem" className={styles.artworkImage} data-hidden={heroArt === 'corrosion' || undefined} />
              : <span className={styles.artworkFallback}>{ego.grade}</span>}
            {corrosionArtwork && <Image src={corrosionArtwork} alt={`${egoLocalName} ${t('ego.corrosionLabel')}`} fill sizes="(max-width: 767px) 85vw, 32rem" className={styles.artworkImage} data-hidden={heroArt !== 'corrosion' || undefined} />}
          </div>
          {!embedded && <Link href={`/sinners/${sinner.id}#ego`} className={styles.backLink}>← {t('ego.backToEgoList')}</Link>}
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
                <MultipliedCount value={amount} />
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
        </section>
      </div>

      {/* between the E.G.O's card and its skills, as on an identity page (DESIGN.md "광고") */}
      {!embedded && <AdSlot place="inline" />}

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
              <SkillFramePanel skill={skill} sinColor={sinColor} skillIconUrl={awakenIconUrl} lang={lang} allowedKeywords={allowedKeywords} />
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
              <SkillFramePanel skill={skill} sinColor={sinColor} skillIconUrl={erosionIconUrl} lang={lang} allowedKeywords={allowedKeywords} />
            </div>
          )) : <p className={styles.empty}>{t('ego.noCorSkillData')}</p>}</div>
        </section>}

        {passiveName && <section className={styles.passive} aria-labelledby="ego-passive">
          <header className={styles.sectionHeading}><h2 id="ego-passive">{t('ego.passive')}</h2></header>
          <div className={styles.passiveContent}>
            <PassiveNameLabel as="h3">{passiveName}</PassiveNameLabel>
            {(passiveDescription || passiveFlavor) && <SkillDescription description={passiveDescription ?? ''} accentColor="#c8900a" variant="detail" allowedKeywords={allowedKeywords} matchPlainKeywords flavorText={passiveFlavor} />}
          </div>
        </section>}
      </div>
    </div>
  )
}

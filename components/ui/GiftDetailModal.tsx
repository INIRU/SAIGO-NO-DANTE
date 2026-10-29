'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Image from 'next/image'
import QuietImage from '@/components/ui/QuietImage'
import { X, ChevronLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import BaseModal from '@/components/ui/BaseModal'
import GiftArtwork, { type GiftArtworkGift } from '@/components/ui/GiftArtwork'
import GiftCard, { GiftEnhanceMark, GiftEnhancePicker } from '@/components/ui/GiftCard'
import { GiftConditionPlate } from '@/components/ui/GiftCondition'
import { blurPlaceholder } from '@/lib/utils/thumbhash'
import KeywordChip from '@/components/ui/KeywordChip'
import { useFormatSkillDesc } from '@/components/sinners/KeywordTooltip'
import { getGiftKeywordColor } from '@/lib/constants/gift'
import { getThemePackCompositeImageUrl, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'
import { getLocalizedAffiliation, getLocalizedName, localizeGiftKeyword } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import type { GiftConditionScope, GiftConditionStatus } from '@/lib/planner/gift-condition-status'
import { gameTextToPlain, splitGameTextLines } from '@/lib/game-text/rich-text'
import { createGiftRefSplitter, type GiftRefTarget } from '@/lib/mirror-dungeon/gift-refs'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import { STORAGE_BASE } from '@/lib/constants/game'
import { conditionLines } from '@/lib/mirror-dungeon/gift-condition-lines'
import { PlaceholderGiftProvider, type PlaceholderGift } from '@/components/ui/PlaceholderLabel'

const CREDIT_ICON = getGameUiAsset('resources/md-credit')
const LOCK_URL = `${STORAGE_BASE}/icons/ui/lock.webp`

function Credits({ value }: { value: number }) {
  return (
    <dd className="inline-flex items-center gap-1 tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)', fontSize: '1.0625rem' }}>
      <Image src={CREDIT_ICON} alt="" width={64} height={64} unoptimized className="size-[1.125rem] self-center" />
      {value}
    </dd>
  )
}

export { localizeGiftKeyword }

export function localizedGiftText(lang: SupportedLang, ko: string | null | undefined, en?: string | null, ja?: string | null): string | null {
  if (lang === 'en' && en) return en
  if (lang === 'ja' && ja) return ja
  return ko ?? null
}

type Condition = {
  type: 'keyword' | 'multi_keyword' | 'affiliation' | 'skill'
  keyword?: string
  keywords?: string[]
  affiliation?: string
  affiliations?: string[]
  skill_condition?: string
  count?: number | null
}

/** One-line activation condition, e.g. "화상 인격 3인 이상". */
export function useGiftConditionText(lang: SupportedLang) {
  const t = useTranslations('giftDetail')
  return (c: Condition | null | undefined): string | null => {
    if (!c) return null
    const count = c.count ?? 0
    if (c.type === 'keyword' || c.type === 'multi_keyword') {
      const keywords = (c.keywords ?? (c.keyword ? [c.keyword] : [])).map(k => localizeGiftKeyword(k, lang))
      return t('conditionIdentity', { keywords: keywords.join('+'), count })
    }
    if (c.type === 'affiliation') {
      const affiliations = (c.affiliations ?? (c.affiliation ? [c.affiliation] : [])).map(a => getLocalizedAffiliation(a, lang))
      return t('conditionAffiliation', { affiliations: affiliations.join('/'), count })
    }
    return t('conditionSkill', { skill: c.skill_condition ?? '', count })
  }
}

export interface GiftDetailTheme {
  id: number | string
  name: string
  name_en?: string | null
  name_jp?: string | null
  image_url?: string | null
  /** How this pack gives the gift beyond its random pool. */
  tag?: 'exclusive' | 'reward'
  onClick?: () => void
}

export interface GiftDetailRecipePart {
  gift?: GiftArtworkGift
  /** Pseudo ingredient such as "any 2 fragments". */
  text?: string
  onClick?: () => void
}

export interface GiftLinkTarget extends GiftRefTarget {
  image_url?: string | null
  /** Game id, so a {{gift:<id>}} placeholder in the effect text shows this gift. */
  gameId?: number | null
  onClick: () => void
}

export interface GiftDetailData {
  name: string
  art: GiftArtworkGift
  /** Korean keyword key for the chip colour and icon. */
  keyword?: string | null
  badges?: { label: string; tone: 'gold' | 'red' | 'orange' | 'purple' }[]
  /** Base, +, ++ effect text, already localized. */
  effects: [string | null, string | null, string | null]
  price?: number | null
  buyDisabled?: boolean
  condition?: string | null
  /** The condition data, for its keyword or affiliation icons and steps. */
  activation?: Condition & { tiers?: { count: number }[] | null; partial?: boolean } | null
  /** The head count the condition reads (giftConditionScope). */
  conditionScope?: GiftConditionScope | null
  conditionStatus?: GiftConditionStatus | null
  recipe?: { ingredients: GiftDetailRecipePart[]; result: GiftDetailRecipePart } | null
  themes?: GiftDetailTheme[]
  /** The gift sits in every listed pack's pool, so one line replaces the list. */
  inAllThemes?: boolean
  /** Other gifts that effect text may name (upgrade targets etc.), rendered as links. */
  giftLinks?: { targets: GiftLinkTarget[]; selfId?: string | null; convertToId?: string | null } | null
}

const BADGE_TONES = {
  gold: { color: '#e8b030', border: 'rgba(200,144,10,0.45)' },
  red: { color: '#e06a5a', border: 'rgba(155,44,35,0.7)' },
  orange: { color: '#e89030', border: 'rgba(232,144,48,0.45)' },
  purple: { color: '#c09ae0', border: 'rgba(180,120,220,0.45)' },
} as const

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t px-5 py-4" style={{ borderColor: '#2e2417' }}>
      <div className="mb-2.5 flex min-h-7 items-center justify-between gap-3">
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem', color: '#9c8b73' }}>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** gate: the gift has a head-count condition; its lines get the game's lock and, while it is unmet (off), fade. */
export function EffectText({ text, color, links, gate }: { text: string; color: string; links?: GiftDetailData['giftLinks']; gate?: { partial: boolean; off: boolean } }) {
  const formatSkillDesc = useFormatSkillDesc()
  const split = useMemo(() => links?.targets.length ? createGiftRefSplitter(links.targets, links) : null, [links])
  // {{gift:<game id>}} (a convert_to gift's target) shows that gift as a link.
  const giftById = useMemo(() => {
    const byId = new Map<number, PlaceholderGift>()
    for (const target of links?.targets ?? []) if (target.gameId != null) byId.set(target.gameId, target)
    return byId.size ? (gameId: number) => byId.get(gameId) : null
  }, [links])
  // Lines split so a tag spanning lines keeps applying; the bullet check reads the visible text, as a line may start with a tag.
  const lines = splitGameTextLines(text).map(l => l.trim()).filter(Boolean)
  const gated = new Set(gate ? conditionLines(lines.map(line => gameTextToPlain(line)), gate.partial)?.gated ?? [] : [])
  const render = (line: string) => split
    ? split(line).map((part, i) => typeof part === 'string'
      ? <span key={i}>{formatSkillDesc(part, color)}</span>
      : <GiftLink key={i} target={part.gift as GiftLinkTarget} />)
    : formatSkillDesc(line, color)
  return (
    <PlaceholderGiftProvider lookup={giftById}>
      <div style={{ color: '#d8ccb4', fontSize: '0.875rem', lineHeight: 1.75 }}>
        {lines.map((line, i) => {
          const isSub = /^-\s/.test(gameTextToPlain(line))
          const locked = gated.has(i)
          return (
            <p key={i} data-gated={locked ? '' : undefined}
              style={{ ...(isSub ? { paddingLeft: '0.875rem', textIndent: '-0.625rem', marginTop: '0.125rem' } : { marginTop: i > 0 ? '0.5rem' : 0 }), ...(locked && gate?.off ? { opacity: 0.45 } : {}), transition: 'opacity 0.2s ease' }}>
              {locked && <Image src={LOCK_URL} alt="" width={118} height={157} className="mr-1.5 inline-block align-[-0.1em]" style={{ width: '0.625rem', height: 'auto' }} />}
              {render(line)}
            </p>
          )
        })}
      </div>
    </PlaceholderGiftProvider>
  )
}

function GiftLink({ target }: { target: GiftLinkTarget }) {
  return (
    <button
      type="button"
      onClick={target.onClick}
      className="mx-0.5 inline-flex items-baseline gap-1 rounded-sm align-baseline underline decoration-[rgba(232,176,48,0.6)] underline-offset-[0.2em] transition-colors hover:text-[#ffd479] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)]"
      style={{ color: 'var(--gold-light)', textIndent: 0, cursor: 'pointer' }}
    >
      {target.image_url && <Image src={target.image_url} alt="" width={18} height={18} className="self-center" style={{ width: '1.125rem', height: '1.125rem', objectFit: 'contain' }} />}
      {target.name}
    </button>
  )
}

function RecipeGift({ part, fragmentsLabel }: { part: GiftDetailRecipePart; fragmentsLabel: string }) {
  if (!part.gift) {
    return (
      <span className="flex h-14 w-14 items-center justify-center rounded-sm border border-dashed px-1 text-center" style={{ borderColor: '#3a2e1e', color: '#9c8b73', fontSize: '0.6875rem', lineHeight: 1.3 }}>
        {part.text ?? fragmentsLabel}
      </span>
    )
  }
  if (!part.onClick) {
    return (
      <span className="flex w-14 flex-col items-center">
        <GiftArtwork gift={part.gift} displayName={part.gift.name} sizes="56px" />
        <span className="mt-1 w-full truncate text-center" style={{ fontSize: '0.625rem', color: '#bfae92', fontFamily: 'var(--font-heading)' }}>{part.gift.name}</span>
      </span>
    )
  }
  return <GiftCard gift={part.gift} onClick={part.onClick} size="3.5rem" />
}

const Sign = ({ children }: { children: ReactNode }) => (
  <span aria-hidden="true" className="flex h-14 items-center" style={{ color: '#6a5a44', fontSize: '1rem' }}>{children}</span>
)

/** Gift detail layout shared by the Mirror Dungeon catalog and the planner. */
export default function GiftDetailModal({ gift, lang, onClose, initialLevel = 0, onBack, backLabel }: {
  gift: GiftDetailData
  lang: SupportedLang
  onClose: () => void
  initialLevel?: number
  /** Shown while viewing a recipe ingredient opened from another gift. */
  onBack?: () => void
  backLabel?: string
}) {
  const t = useTranslations('giftDetail')
  const [base, plus, plusplus] = gift.effects
  const maxLevel = plusplus ? 2 : plus ? 1 : 0
  const [level, setLevel] = useState(Math.min(initialLevel, maxLevel))
  const effect = [base, plus, plusplus][level] ?? base
  const effectColor = level === 2 ? '#e8b030' : level === 1 ? '#d8b878' : '#c8b898'
  const kwColor = getGiftKeywordColor(gift.keyword ?? null)
  // Reward and exclusive packs come first; a long pool list shows six chips and a "+N" that expands.
  const [showAllThemes, setShowAllThemes] = useState(false)
  const themes = gift.themes ?? []
  const visibleThemes = showAllThemes ? themes : themes.slice(0, Math.max(6, themes.filter(theme => theme.tag).length))
  const hiddenThemeCount = themes.length - visibleThemes.length

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="34rem" title={gift.name || t('title')} sheet>
      <div
        className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-xl border sm:max-h-[85vh] sm:rounded-xl"
        style={{ background: '#17120c', borderColor: '#2e2417', boxShadow: '0 1.5rem 4rem rgba(0,0,0,0.6)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute right-2 top-2 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)]"
          style={{ color: '#9c8b73' }}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="overflow-y-auto overscroll-contain" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="ml-3 mt-3 inline-flex min-h-9 items-center gap-1 rounded px-2 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)]"
              style={{ color: '#bfae92', fontSize: '0.8125rem' }}
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {backLabel}
            </button>
          )}

          <header className="flex items-center gap-4 px-5 pb-4 pr-14 pt-5 sm:gap-5">
            <div className="relative w-[5.75rem] shrink-0 sm:w-[7.5rem]" style={{ filter: 'drop-shadow(0 0.5rem 1rem ' + kwColor + '33)' }}>
              <GiftArtwork gift={gift.art} displayName={gift.name} enhance={level} sizes="120px">
                {level > 0 && <GiftEnhanceMark level={level} />}
              </GiftArtwork>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-pretty" style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3125rem', lineHeight: 1.3, color: 'var(--text-primary)' }}>
                {gift.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {gift.keyword && <KeywordChip keyword={gift.keyword} label={localizeGiftKeyword(gift.keyword, lang)} size="md" />}
                {gift.badges?.map(b => (
                  <span key={b.label} className="inline-flex items-center rounded-sm border px-2" style={{ minHeight: '1.5rem', fontSize: '0.75rem', color: BADGE_TONES[b.tone].color, borderColor: BADGE_TONES[b.tone].border }}>
                    {b.label}
                  </span>
                ))}
              </div>
              {(gift.price != null || gift.buyDisabled) && (
                <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: '0.8125rem' }}>
                  {gift.buyDisabled ? (
                    <div className="flex gap-1.5"><dt className="sr-only">{t('price')}</dt><dd style={{ color: '#e06a5a' }}>{t('notForSale')}</dd></div>
                  ) : gift.price != null && (
                    <div className="flex items-center gap-1.5"><dt style={{ color: '#9c8b73' }}>{t('price')}</dt><Credits value={gift.price} /></div>
                  )}
                </dl>
              )}
            </div>
          </header>

          {/* The condition gates the effect, so it sits between the gift and its effect, marked with the game's lock. */}
          {gift.condition && <GiftConditionPlate text={gift.condition} condition={gift.activation} scope={gift.conditionScope} status={gift.conditionStatus} />}

          {effect && (
            <Section
              title={t('effect')}
              aside={maxLevel > 0 && (
                <div className="w-[9.5rem] shrink-0 [&>div]:mt-0">
                  <GiftEnhancePicker level={level} max={maxLevel as 1 | 2} giftName={gift.name} onChange={setLevel} />
                </div>
              )}
            >
              <EffectText key={level} text={effect} color={effectColor} links={gift.giftLinks}
                gate={gift.condition ? { partial: !!gift.activation?.partial, off: gift.conditionStatus?.level === 'unmet' } : undefined} />
            </Section>
          )}

          {gift.recipe && (
            <Section title={t('recipe')}>
              <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
                {gift.recipe.ingredients.map((part, i) => (
                  <span key={i} className="flex items-start gap-2">
                    {i > 0 && <Sign>+</Sign>}
                    <RecipeGift part={part} fragmentsLabel={t('recipeFragments')} />
                  </span>
                ))}
                <Sign>=</Sign>
                <RecipeGift part={gift.recipe.result} fragmentsLabel={t('recipeFragments')} />
              </div>
            </Section>
          )}

          {gift.inAllThemes ? (
            <Section title={t('themes')}>
              <p style={{ fontSize: '0.875rem', color: '#d8ccb4' }}>{t('allThemes')}</p>
            </Section>
          ) : themes.length > 0 && (
            <Section title={t('themes')} aside={<span className="tabular-nums" style={{ fontFamily: 'var(--font-title)', fontSize: '1.125rem', color: '#6a5a44' }}>{themes.length}</span>}>
              <ul className="flex flex-wrap gap-1.5">
                {visibleThemes.map(theme => <ThemeChip key={theme.id} theme={theme} lang={lang} tagLabel={theme.tag === 'reward' ? t('clearReward') : theme.tag === 'exclusive' ? t('exclusive') : null} />)}
                {hiddenThemeCount > 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setShowAllThemes(true)}
                      aria-label={t('showAllThemes', { count: themes.length })}
                      className="inline-flex h-8 items-center rounded-sm border px-2.5 tabular-nums transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)]"
                      style={{ borderColor: '#3a2e1e', color: '#d8ccb4', fontSize: '0.8125rem' }}
                    >
                      +{hiddenThemeCount}
                    </button>
                  </li>
                )}
              </ul>
            </Section>
          )}

          <div className="h-2 sm:h-1" />
        </div>
      </div>
    </BaseModal>
  )
}

function ThemeChip({ theme, lang, tagLabel }: { theme: GiftDetailTheme; lang: SupportedLang; tagLabel: string | null }) {
  const id = Number(theme.id)
  const src = getThemePackVisualConfig(id) ? getThemePackCompositeImageUrl(id) : theme.image_url
  const name = getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang)
  const tagColor = theme.tag === 'reward' ? '#e06a5a' : '#e8b030'
  const body = (
    <>
      {src && (
        <span className="relative h-6 shrink-0 overflow-hidden" style={{ aspectRatio: '416/684' }}>
          <QuietImage src={src} alt="" fill sizes="16px" className="object-cover" {...blurPlaceholder(src)} />
        </span>
      )}
      <span className="truncate" style={{ color: '#d8ccb4' }}>{name}</span>
      {tagLabel && <span className="shrink-0" style={{ color: tagColor, fontSize: '0.6875rem', fontFamily: 'var(--font-heading)' }}>{tagLabel}</span>}
    </>
  )
  const className = 'inline-flex h-8 max-w-[15rem] items-center gap-1.5 rounded-sm border pl-1 pr-2.5'
  const style = { borderColor: theme.tag ? (theme.tag === 'reward' ? 'rgba(155,44,35,0.7)' : 'rgba(200,144,10,0.4)') : '#2e2417', background: '#0d0b08', fontSize: '0.8125rem' }
  return (
    <li>
      {theme.onClick ? (
        <button type="button" onClick={theme.onClick} className={className + ' transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)]'} style={{ ...style, cursor: 'pointer' }}>
          {body}
        </button>
      ) : <span className={className} style={style}>{body}</span>}
    </li>
  )
}

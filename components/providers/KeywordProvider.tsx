'use client'

import { cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import KeywordIcon from '@/components/ui/KeywordIcon'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import useSWR, { preload } from 'swr'
import { STORAGE_BASE } from '@/lib/constants/game'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
import { getKeywordIndex, resolveKeywordIconUrl, type KeywordInfo } from '@/lib/keywords/catalog'
export { resolveKeywordIconUrl, type KeywordInfo } from '@/lib/keywords/catalog'
import { KEYWORD_DEFAULT_COLOR, KEYWORD_NEGATIVE_COLOR, resolveKeywordTextColor } from '@/lib/keywords/text-color'
import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'
import { getLocalizedKeywordDesc, getLocalizedKeywordName } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n'
import { PlaceholderText } from '@/components/ui/PlaceholderLabel'
import { mayBeRawGameText, parseGameText } from '@/lib/game-text/rich-text'
import { preloadGameTextRefDescriptions, preloadGameTextRefFlavors, useGameTextRefDescription, useKeywordFlavor, wantGameTextRefs } from '@/lib/hooks/useGameTextRefs'
import GameText from '@/components/game-text/GameText'
import { keywordTextAllowed } from '@/lib/keywords/plain-keywords'
import { FLAVOR_COLOR } from '@/lib/game-text/flavor'

const KeywordContext = createContext<Record<string, KeywordInfo>>({})

/** Keyword name colour shared by the tooltip and the keyword archive. */
export function keywordAccentColor(keyword: string, info?: KeywordInfo): string {
  return GIFT_KEYWORD_COLORS[keyword] ?? resolveKeywordTextColor(keyword, info)
}

export function KeywordProvider({
  keywords,
  children,
}: {
  keywords: Record<string, KeywordInfo>
  children: React.ReactNode
}) {
  return (
    <KeywordContext.Provider value={keywords}>
      {children}
    </KeywordContext.Provider>
  )
}

export function useKeywords() {
  return useContext(KeywordContext)
}

// The layout's catalog has no descriptions (they only show in tooltips); one cached request per language brings them.
const descriptionsUrl = (locale: string) => `/api/keyword-descriptions/${locale}`
const fetchDescriptions = (url: string): Promise<Record<string, string>> =>
  fetch(url).then(response => { if (!response.ok) throw new Error(`${response.status}`); return response.json() })
const DESCRIPTION_OPTIONS = { revalidateOnFocus: false, revalidateIfStale: false, revalidateOnReconnect: false } as const

/** Starts loading the descriptions (e.g. when a keyword is hovered) so the tooltip usually opens with its text. */
export function preloadKeywordDescriptions(locale: string) {
  void preload(descriptionsUrl(locale), fetchDescriptions).catch(() => {})
}

/**
 * Description of a keyword in the page language: from the catalog when it carries one (older snapshots), otherwise from
 * the lazily loaded descriptions (only when `enabled`). `undefined` while loading; '' when the keyword has none.
 */
export function useKeywordDescription(keyword: string, info: KeywordInfo | undefined, enabled = true): string | undefined {
  const locale = useLocale()
  const inline = info ? getLocalizedKeywordDesc(info.desc, info, locale as SupportedLang) : ''
  const { data, error } = useSWR(inline || !enabled ? null : descriptionsUrl(locale), fetchDescriptions, DESCRIPTION_OPTIONS)
  if (inline) return inline
  if (data) return data[keyword] ?? ''
  return error ? '' : undefined
}

type FormatSkillDescOptions = {
  /** Tooltips: numbers turn gold and Potency/Count terms take this colour. */
  highlightValues?: string
  /**
   * Skill and passive text of an identity or E.G.O only: draw the keywords the 4th argument (`allowedKeywords`) names when
   * the text writes them as plain words (older game text), see lib/keywords/plain-keywords.ts. Off everywhere else.
   */
  matchPlainKeywords?: boolean
  /** A keyword's own description (tooltip, keyword page): `allowedKeywords` from keywordTextAllowed, the longer name list. */
  keywordText?: boolean
  /** Drawn inside a tooltip: its keywords show icon and colour but open no tooltip of their own. */
  nested?: boolean
}

/**
 * formatSkillDesc를 훅으로 제공 — 컴포넌트 최상위에서 호출.
 *
 * Game text (skill, passive, E.G.O, gift and keyword descriptions) is always drawn by GameText, even when it holds no tag or
 * `[Id]`: it then shows as plain text, and words are not searched for keywords (the stored text is the game's own), except
 * where `options.matchPlainKeywords` is set: the skill and passive text of an identity / E.G.O, with the keywords that
 * identity / E.G.O owns as `allowedKeywords` (no set or an empty one: nothing is searched).
 * Notes do not come through here: NoteRenderer shows a user memo's keywords only as explicit chips (`noteKeyword` nodes,
 * `[k:이름]` tokens) and everything else as written.
 * Of the other arguments, `skillNameColors` and `highlightValues` are carried over to GameText (own skill names coloured
 * by sin; gold numbers in tooltips).
 */
export function useFormatSkillDesc() {
  const keywords = useKeywords()

  return useCallback(
    (text: string, color: string, skillNameColors?: Record<string, string>, allowedKeywords?: ReadonlySet<string>, options?: FormatSkillDescOptions) => {
      if (mayBeRawGameText(text)) wantGameTextRefs()
      return (
        <GameText
          nodes={parseGameText(text)}
          accent={color}
          keywords={keywords}
          keywordRef={KeywordWithTooltip}
          skillNameColors={skillNameColors}
          highlightValues={options?.highlightValues}
          matchPlainKeywords={options?.matchPlainKeywords}
          allowedKeywords={allowedKeywords}
          keywordText={options?.keywordText}
          nested={options?.nested}
        />
      )
    },
    [keywords],
  )
}

/**
 * For stored text that is not a skill description (flavor, a keyword's own description): game source text is drawn as
 * the game wrote it, anything else is shown as written, `{{token}}` as labels. Plain words are never searched for keywords.
 * `nested` is for use inside a tooltip (see GameText).
 */
export function useFormatGameText() {
  const keywords = useKeywords()
  return useCallback((text: string, color: string, nested = false) => {
    if (!mayBeRawGameText(text)) return <PlaceholderText text={text} />
    wantGameTextRefs()
    return <GameText nodes={parseGameText(text)} accent={color} keywords={keywords} keywordRef={KeywordWithTooltip} nested={nested} />
  }, [keywords])
}

// ─── 내부 구현 (KeywordTooltip.tsx에서 이동) ────────────────────────
// 이 함수는 훅이 아니므로 직접 호출하지 마세요. useFormatSkillDesc()를 사용하세요.

/**
 * Context 기반 키워드 데이터 훅.
 * KEYWORD_SIN_MAP / KEYWORD_ICON_MAP 하드코딩 대체용.
 */
export function useKeywordData() {
  return getKeywordIndex(useKeywords())
}

/**
 * Tooltip of a keyword. `info` is its keyword_meta row; without one (a `[Id]` of game text that has no row) the popup
 * shows the name as given and the game's own description of `refId`, drawn as game text.
 */
function KwTooltipPopup({ id, rect, iconUrl, keyword, info, refId, onMouseEnter, onMouseLeave }: {
  id: string; rect: DOMRect; iconUrl: string | null; keyword: string; info?: KeywordInfo; refId?: string
  onMouseEnter: () => void; onMouseLeave: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const t = useTranslations()
  const locale = useLocale()

  const formatDescription = useFormatSkillDesc()
  const keywords = useKeywords()
  const localName = getLocalizedKeywordName(keyword, info, locale as SupportedLang)
  const metaDesc = useKeywordDescription(keyword, info, !!info)
  const refDesc = useGameTextRefDescription(refId ?? '', !info && !!refId)
  const localDesc = info ? metaDesc : refDesc
  // The game's flavor line of the keyword (brown italic under the description, as under skills and passives).
  const flavor = useKeywordFlavor({ refId, keyword: info ? keyword : null }, true)
  const formatGameText = useFormatGameText()

  const spaceAbove = rect.top
  const spaceBelow = window.innerHeight - rect.bottom
  const showAbove = spaceAbove > spaceBelow
  const maxH = Math.min((showAbove ? spaceAbove : spaceBelow) - 24, window.innerHeight * 0.5)
  // 22rem, never wider than the viewport minus 0.75rem gutters; arrow stays over the trigger.
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const width = Math.min(22 * rem, window.innerWidth - 1.5 * rem)
  const gutter = 0.75 * rem
  const left = Math.max(gutter, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - gutter))
  const arrowX = Math.max(12, Math.min(rect.left + rect.width / 2 - left, width - 12))
  const color = keywordAccentColor(keyword, info)

  useEffect(() => {
    const el = contentRef.current
    if (el) setOverflowing(el.scrollHeight > el.clientHeight)
  }, [localDesc, flavor])

  return (
    <span
      id={id}
      className="z-[200] rounded text-left"
      role="tooltip"
      onPointerEnter={event => { if (event.pointerType === 'mouse') onMouseEnter() }}
      onPointerLeave={event => { if (event.pointerType === 'mouse') onMouseLeave() }}
      style={{
        position: 'fixed',
        left,
        ...(showAbove
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
        background: '#17120c',
        border: `1px solid ${color}66`,
        boxShadow: '0 12px 32px #000a',
        width,
        whiteSpace: 'normal',
      }}
    >
      <span aria-hidden style={{
        position: 'absolute', left: arrowX - 5, width: 10, height: 10, background: '#17120c', transform: 'rotate(45deg)',
        ...(showAbove
          ? { bottom: -6, borderRight: `1px solid ${color}66`, borderBottom: `1px solid ${color}66` }
          : { top: -6, borderLeft: `1px solid ${color}66`, borderTop: `1px solid ${color}66` }),
      }} />
      <div
        ref={contentRef}
        style={{
          position: 'relative',
          padding: '0.875rem 1rem 1rem',
          maxHeight: maxH,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        <span style={{ color, fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem', paddingBottom: '0.625rem', borderBottom: `1px solid ${color}33` }}>
          {iconUrl && (
            <KeywordIcon src={iconUrl} alt="" width={16} height={16} unoptimized style={{ flexShrink: 0, width: '1.5rem', height: '1.5rem' }} />
          )}
          {localName}
          {info?.maxStack ? (
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {t('keyword.maxStack')} <b style={{ color: 'var(--gold-light)' }}>{info.maxStack}</b>
            </span>
          ) : null}
        </span>
        <span style={{ color: '#d0c7b8', fontSize: '0.875rem', lineHeight: 1.75, display: 'block', whiteSpace: 'pre-line' }}>
          {localDesc === undefined
            ? <span aria-hidden="true" style={{ display: 'block', height: '3.5em', borderRadius: '0.25rem', background: 'linear-gradient(90deg, #211a12, #2b2218, #211a12)' }} />
            : info
              ? formatDescription(localDesc, '#d0c7b8', undefined, keywordTextAllowed(keyword), { highlightValues: color, matchPlainKeywords: true, keywordText: true, nested: true })
              : <GameText nodes={parseGameText(localDesc)} accent="#d0c7b8" keywords={keywords} keywordRef={KeywordWithTooltip} nested matchPlainKeywords allowedKeywords={keywordTextAllowed(keyword)} keywordText />}
        </span>
        {flavor && localDesc !== undefined && (
          <span style={{ display: 'block', marginTop: '0.625rem', color: FLAVOR_COLOR, fontStyle: 'italic', fontSize: '0.8125rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {formatGameText(flavor, FLAVOR_COLOR, true)}
          </span>
        )}
      </div>
      {overflowing && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0, height: 32,
          background: 'linear-gradient(to bottom, transparent, #17120c)',
          borderRadius: '0 0 4px 4px',
          pointerEvents: 'none',
        }} />
      )}
    </span>
  )
}

// 한 번에 하나의 키워드 툴팁만 표시
let activeKwClose: (() => void) | null = null

/** 키워드 아이콘 + 툴팁 (context에서 키워드 데이터 사용) */
export function KeywordWithTooltip({
  keyword,
  krKey,
  inline,
  children,
  displayColor,
  plain,
  refId,
  iconSlug,
  nested,
}: {
  keyword: string
  /** KR key for lookup when keyword is an EN/JP name */
  krKey?: string
  inline?: boolean
  children?: React.ReactNode
  displayColor?: string
  /** Only the tooltip: no icon in front of the text and no keyword colour on it (a `<link>` in game text). */
  plain?: boolean
  /** A keyword `[Id]` of game text: when it has no keyword_meta row the tooltip shows the game's own description of it. */
  refId?: string
  /** The buff's own icon file (game_text_refs.icon_slug), for this keyword and its tooltip instead of keyword_meta's. */
  iconSlug?: string
  /** Inside a tooltip: icon and colour only, no tooltip of its own (a tooltip in a tooltip). */
  nested?: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const keywords = useKeywords()
  const lookupKey = krKey ?? keyword
  const info = keywords[lookupKey]
  const hasTooltip = !nested && (!!info || !!refId)
  const iconUrl = refId && !info && !iconSlug ? null : getKeywordIconUrl(lookupKey, iconSlug ?? info?.iconSlug)
  const [failedIconUrl, setFailedIconUrl] = useState<string | null>(null)
  const visibleIconUrl = failedIconUrl === iconUrl ? null : iconUrl

  const locale = useLocale()
  // Whether the tooltip was open when the current press began: the click that follows turns it the other way.
  // (A tap also focuses the keyword, which opens the tooltip before its click arrives.)
  const pressedOpen = useRef(false)
  // The last press landed inside the tooltip: the keyword then loses focus, which must not close it.
  const pressedInPopup = useRef(false)
  const hide = useCallback(() => setRect(null), [])
  const close = useCallback(() => { setRect(null); if (activeKwClose === hide) activeKwClose = null }, [hide])
  const show = useCallback(() => {
    if (refId && !info) preloadGameTextRefDescriptions(locale)
    else preloadKeywordDescriptions(locale)
    preloadGameTextRefFlavors(locale)
    if (activeKwClose && activeKwClose !== hide) activeKwClose()
    clearTimeout(hideTimeout.current)
    setRect(ref.current?.getBoundingClientRect() ?? null)
    activeKwClose = hide
  }, [hide, locale, refId, info])
  const scheduleHide = useCallback(() => {
    hideTimeout.current = setTimeout(close, 120)
  }, [close])
  const cancelHide = useCallback(() => {
    clearTimeout(hideTimeout.current)
  }, [])
  // The tooltip is a React child drawn in document.body, so its events bubble here too: only the keyword's own count.
  const own = (e: React.SyntheticEvent) => e.currentTarget.contains(e.target as Node)
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!own(e)) return
    e.preventDefault()
    if (pressedOpen.current) close()
    else show()
  }

  useEffect(() => {
    if (!rect) return
    const popup = () => document.getElementById(tooltipId)
    // A press outside the keyword and its tooltip closes it. Inside the tooltip it stays, so its text can be scrolled.
    const press = (e: PointerEvent) => {
      const target = e.target as Node
      pressedInPopup.current = !!popup()?.contains(target)
      if (!pressedInPopup.current && !ref.current?.contains(target)) close()
    }
    // The tooltip is fixed to the screen: once the keyword moves away under it (page or panel scroll), close it.
    const scroll = (e: Event) => {
      if (e.target instanceof Node && popup()?.contains(e.target)) return
      const now = ref.current?.getBoundingClientRect()
      if (!now || Math.abs(now.top - rect.top) > 1 || Math.abs(now.left - rect.left) > 1) close()
    }
    document.addEventListener('pointerdown', press)
    window.addEventListener('scroll', scroll, { capture: true, passive: true })
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', press)
      window.removeEventListener('scroll', scroll, { capture: true })
      window.removeEventListener('resize', close)
    }
  }, [rect, tooltipId, close])

  const textColorHint = `${keyword} ${lookupKey}`
  const iconColorHint = `${info?.iconSlug ?? ''} ${iconUrl ?? ''}`.toLowerCase()
  const hasBladetrailHint =
    textColorHint.includes('검흔') ||
    textColorHint.includes('잔상') ||
    textColorHint.includes('Bladetrail') ||
    iconColorHint.includes('bladetrail-afterimage') ||
    iconColorHint.includes('bladetrail')
  const explicitEffectType = info?.effectType ?? info?.effect_type
  let resolvedDisplayColor = !explicitEffectType && hasBladetrailHint ? KEYWORD_NEGATIVE_COLOR : displayColor
  if (!resolvedDisplayColor || resolvedDisplayColor === KEYWORD_DEFAULT_COLOR) {
    resolvedDisplayColor = resolveKeywordTextColor(keyword, info, lookupKey)
  }

  const renderedChildren = plain || resolvedDisplayColor === KEYWORD_DEFAULT_COLOR
    ? children
    : isValidElement<{ style?: React.CSSProperties }>(children)
      ? cloneElement(children, { style: { ...children.props.style, color: resolvedDisplayColor } })
      : <span style={{ color: resolvedDisplayColor }}>{children}</span>

  if (plain ? !hasTooltip : !hasTooltip && !iconUrl) return <>{renderedChildren}</>

  return (
    <span
      ref={ref}
      data-game-ref={refId}
      className="inline keyword-token rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
      onPointerEnter={e => { if (e.pointerType === 'mouse') show() }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') scheduleHide() }}
      onPointerDown={e => { if (own(e)) pressedOpen.current = !!rect }}
      onFocus={e => { if (own(e)) show() }}
      onBlur={e => {
        if (!own(e)) return
        if (pressedInPopup.current) pressedInPopup.current = false
        else scheduleHide()
      }}
      onKeyDown={hasTooltip ? e => { if (e.key === 'Escape') hide() } : undefined}
      onClick={toggle}
      tabIndex={hasTooltip ? 0 : undefined}
      aria-describedby={rect && hasTooltip ? tooltipId : undefined}
      style={{ cursor: hasTooltip ? 'help' : 'default', position: 'relative' }}
    >
      {!plain && visibleIconUrl && (
        <KeywordIcon
          src={visibleIconUrl}
          onError={() => setFailedIconUrl(visibleIconUrl)}
          alt=""
          width={inline ? 14 : 16}
          height={inline ? 14 : 16}
          unoptimized
          style={{
            display: 'inline',
            verticalAlign: 'text-bottom',
            marginRight: inline ? '0.0625rem' : '0.1875rem',
            width: '1em',
            height: '1em',
          }}
        />
      )}
      {renderedChildren}
      {rect && hasTooltip && typeof document !== 'undefined' && createPortal(
        <KwTooltipPopup id={tooltipId} rect={rect} iconUrl={visibleIconUrl} keyword={info ? lookupKey : keyword} info={info} refId={refId} onMouseEnter={cancelHide} onMouseLeave={scheduleHide} />,
        document.body,
      )}
    </span>
  )
}

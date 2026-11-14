'use client'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import BaseModal from '@/components/ui/BaseModal'
import IdentityFrameCard from '@/features/catalog/components/IdentityFrameCard'
import { EffectText } from '@/features/mirror-dungeon/components/GiftDetailModal'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { GIFT_KEYWORD_COLORS, getGiftKeywordColor, getGiftKeywordIconUrl, getGiftKeywordSlug } from '@/lib/constants/gift'
import { localizeGiftKeyword } from '@/lib/i18n/gift-keyword'
import type { SupportedLang } from '@/lib/i18n/types'
import { assetName, type NoteAssetData } from '@/features/notes/lib/assets'
import { PREVIEW_DELAY_MS, PREVIEW_WIDTHS_REM, usesHover } from '@/features/notes/lib/preview'
import { placePopoverIn, type PopoverPlacement } from '@/lib/utils/popover'
import { NoteAssetArtwork } from './NoteBlockViewer'
import { tr } from '@/features/notes/lib/tr'


/** The card itself: art on the left, name and what it is on the right (a gift also says what it does). */
function NotePreviewBody({ asset }: { asset: NoteAssetData }) {
  const lang = useLocale(), tSinner = useTranslations('sinner')
  const name = assetName(asset, lang)
  const sinnerId = asset.identity?.sinner_id ?? asset.sinnerId
  const sub = [sinnerId ? tSinner(sinnerId) : null, asset.kind === 'ego' && asset.ego?.grade ? asset.ego.grade : null].filter(Boolean).join(' · ')
  // A gift's keyword reads like the detail window's stat line: its icon and its colour.
  const keyword = asset.kind === 'gift' ? asset.keyword : null
  const kwSlug = keyword ? getGiftKeywordSlug(keyword) : null
  const kwIcon = kwSlug ? getGiftKeywordIconUrl(kwSlug) : null
  const description = (lang === 'en' ? asset.description_en : lang === 'ja' ? asset.description_jp : asset.description) || asset.description
  return <div className="note-preview-card" data-kind={asset.kind}>
    <div className="note-preview-art">
      {asset.kind === 'identity' && asset.identity ? <IdentityFrameCard identity={asset.identity} name={name} sizes="7rem" /> : <NoteAssetArtwork asset={asset} compact />}
    </div>
    <div className="note-preview-text">
      <strong>{name}</strong>
      {sub && <small>{sub}</small>}
      {keyword && <small className="note-preview-keyword" style={{ color: getGiftKeywordColor(keyword) }}>
        {kwIcon && <Image src={kwIcon} alt="" width={16} height={16} />}{localizeGiftKeyword(keyword, lang as SupportedLang)}
      </small>}
      {asset.kind === 'gift' && description && <EffectText text={description} color={GIFT_KEYWORD_COLORS[asset.keyword ?? ''] ?? '#c8b898'} />}
    </div>
  </div>
}

/**
 * Wraps a name in a sentence so it shows a preview card: on hover or keyboard focus after PREVIEW_DELAY_MS for a mouse or a
 * pen, in a modal on a touch tap (with a link to the page). Touch never hovers. `modalOnTap` off leaves a tap to the name's own action.
 */
export default function NotePreviewHost({ asset, href, modalOnTap = true, block = false, children }: { asset: NoteAssetData | undefined; href?: string; modalOnTap?: boolean
  /** A block host (a grid cell) instead of a name inside a sentence. */
  block?: boolean; children: ReactNode }) {
  const lang = useLocale()
  const host = useRef<HTMLSpanElement>(null), card = useRef<HTMLDivElement>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined), closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastPointer = useRef('')
  const [anchor, setAnchor] = useState<DOMRect | null>(null), [place, setPlace] = useState<PopoverPlacement | null>(null), [modal, setModal] = useState(false)
  const open = () => { clearTimeout(closeTimer.current); clearTimeout(openTimer.current); openTimer.current = setTimeout(() => setAnchor(host.current?.getBoundingClientRect() ?? null), PREVIEW_DELAY_MS) }
  const close = () => { clearTimeout(openTimer.current); clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => { setAnchor(null); setPlace(null) }, 120) }
  useEffect(() => () => { clearTimeout(openTimer.current); clearTimeout(closeTimer.current) }, [])
  useLayoutEffect(() => {
    if (!anchor || !card.current) return
    // the window the name is in: a page, or the Assist's Picture-in-Picture window (another document)
    const doc = host.current?.ownerDocument ?? document
    const rem = parseFloat(doc.defaultView?.getComputedStyle(doc.documentElement).fontSize ?? '') || 16
    // measured on the hidden card itself: the narrowest width whose real height fits the screen
    setPlace(placePopoverIn(card.current, card.current, { anchor, view: { width: doc.documentElement.clientWidth, height: doc.defaultView?.innerHeight ?? window.innerHeight }, widths: PREVIEW_WIDTHS_REM.map(width => width * rem) }))
  }, [anchor])
  useEffect(() => {
    if (!anchor) return
    // the card scrolls inside itself when it is capped; that scroll must not close it
    // nor may a keyword tooltip opened from the card (drawn over it, outside it in the page)
    const hide = (event?: Event) => { if (event?.target instanceof Node && (card.current?.contains(event.target) || (event.target instanceof Element && event.target.closest('[data-kw-tip]')))) return; clearTimeout(openTimer.current); setAnchor(null); setPlace(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') hide() }
    const resize = () => hide()
    const doc = host.current?.ownerDocument ?? document, view = doc.defaultView ?? window
    view.addEventListener('scroll', hide, { capture: true, passive: true })
    view.addEventListener('resize', resize)
    doc.addEventListener('keydown', escape)
    return () => { view.removeEventListener('scroll', hide, { capture: true }); view.removeEventListener('resize', resize); doc.removeEventListener('keydown', escape) }
  }, [anchor])
  if (!asset) return <>{children}</>
  return <>
    <span
      className="note-preview-host" ref={host} style={block ? { display: 'block' } : undefined}
      onPointerDown={event => { lastPointer.current = event.pointerType }}
      onPointerEnter={event => { if (usesHover(event.pointerType)) open() }}
      onPointerLeave={close}
      onFocus={event => { if (event.target.matches(':focus-visible')) open() }}
      onBlur={close}
      onClickCapture={event => {
        if (!modalOnTap || lastPointer.current !== 'touch') return
        event.preventDefault(); event.stopPropagation(); setAnchor(null); setModal(true)
      }}
    >{children}</span>
    {anchor && createPortal(
      <div ref={card} className="note-preview-popover" role="tooltip" data-above={place?.above || undefined}
        style={{ left: place?.left ?? 0, top: place?.top ?? 0, width: place?.width, maxHeight: place?.maxHeight, visibility: place ? 'visible' : 'hidden' }}
        onPointerEnter={event => { if (usesHover(event.pointerType)) { clearTimeout(closeTimer.current) } }} onPointerLeave={close}>
        <NotePreviewBody asset={asset} />
      </div>, host.current?.ownerDocument.body ?? document.body)}
    <BaseModal open={modal} onClose={() => setModal(false)} title={assetName(asset, lang)} maxWidth="26rem" zIndex={10000}>
      <div className="note-preview-modal">
        <NotePreviewBody asset={asset} />
        {href && <Link href={href} className="note-preview-more" onClick={() => setModal(false)}>{tr(lang, '자세히 보기', '詳しく見る', 'View details')}</Link>}
      </div>
    </BaseModal>
  </>
}

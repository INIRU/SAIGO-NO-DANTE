'use client'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import BaseModal from '@/components/ui/BaseModal'
import IdentityFrameCard from '@/components/ui/IdentityFrameCard'
import { EffectText } from '@/components/ui/GiftDetailModal'
import { Link } from '@/lib/i18n/navigation'
import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'
import { assetName, type NoteAssetData } from '@/lib/notes/assets'
import { PREVIEW_DELAY_MS, previewPlacement, usesHover } from '@/lib/notes/preview'
import { NoteAssetArtwork } from './NoteBlockViewer'

const tr = (lang: string, ko: string, ja: string, en: string) => lang === 'ja' ? ja : lang === 'en' ? en : ko

/** The card itself: art on the left, name and what it is on the right (a gift also says what it does). */
export function NotePreviewBody({ asset }: { asset: NoteAssetData }) {
  const lang = useLocale(), tSinner = useTranslations('sinner')
  const name = assetName(asset, lang)
  const sinnerId = asset.identity?.sinner_id ?? asset.sinnerId
  const sub = [sinnerId ? tSinner(sinnerId) : null, asset.kind === 'ego' && asset.ego?.grade ? asset.ego.grade : null, asset.kind === 'gift' ? asset.keyword : null].filter(Boolean).join(' · ')
  const description = (lang === 'en' ? asset.description_en : lang === 'ja' ? asset.description_jp : asset.description) || asset.description
  return <div className="note-preview-card" data-kind={asset.kind}>
    <div className="note-preview-art">
      {asset.kind === 'identity' && asset.identity ? <IdentityFrameCard identity={asset.identity} name={name} sizes="7rem" /> : <NoteAssetArtwork asset={asset} compact />}
    </div>
    <div className="note-preview-text">
      <strong>{name}</strong>
      {sub && <small>{sub}</small>}
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
  const [anchor, setAnchor] = useState<DOMRect | null>(null), [place, setPlace] = useState<{ left: number; top: number; above: boolean } | null>(null), [modal, setModal] = useState(false)
  const open = () => { clearTimeout(closeTimer.current); clearTimeout(openTimer.current); openTimer.current = setTimeout(() => setAnchor(host.current?.getBoundingClientRect() ?? null), PREVIEW_DELAY_MS) }
  const close = () => { clearTimeout(openTimer.current); clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => { setAnchor(null); setPlace(null) }, 120) }
  useEffect(() => () => { clearTimeout(openTimer.current); clearTimeout(closeTimer.current) }, [])
  useLayoutEffect(() => {
    if (!anchor || !card.current) return
    const size = card.current.getBoundingClientRect()
    // the window the name is in: a page, or the Assist's Picture-in-Picture window (another document)
    const doc = host.current?.ownerDocument ?? document
    setPlace(previewPlacement(anchor, size, { width: doc.documentElement.clientWidth, height: doc.defaultView?.innerHeight ?? window.innerHeight }))
  }, [anchor])
  useEffect(() => {
    if (!anchor) return
    const hide = () => { clearTimeout(openTimer.current); setAnchor(null); setPlace(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') hide() }
    const doc = host.current?.ownerDocument ?? document, view = doc.defaultView ?? window
    view.addEventListener('scroll', hide, { capture: true, passive: true })
    view.addEventListener('resize', hide)
    doc.addEventListener('keydown', escape)
    return () => { view.removeEventListener('scroll', hide, { capture: true }); view.removeEventListener('resize', hide); doc.removeEventListener('keydown', escape) }
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
        style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? 'visible' : 'hidden' }}
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

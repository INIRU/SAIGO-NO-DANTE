'use client'
import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import { lightboxStartTransform } from '@/lib/notes/lightbox'

const tr = (lang: string, ko: string, ja: string, en: string) => lang === 'ja' ? ja : lang === 'en' ? en : ko

/** The big picture: grows out of the picture that was pressed (unless the reader asked for less motion). */
function LargeImage({ src, alt, from, onClose }: { src: string; alt: string; from: DOMRect | null; onClose: () => void }) {
  const image = useRef<HTMLImageElement>(null), grown = useRef(false)
  const grow = () => {
    const el = image.current
    if (!el || grown.current || !from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const transform = lightboxStartTransform(from, el.getBoundingClientRect())
    if (!transform) return
    grown.current = true
    el.animate([{ transform }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
  }
  // A picture already in the cache is complete before onLoad can fire.
  useEffect(() => { if (image.current?.complete) grow() })
  return <img ref={image} src={src} alt={alt} className="note-lightbox-image" onLoad={grow} onClick={onClose} />
}

/**
 * A note image in the reading view: pressing it opens it large in a modal (Esc, the backdrop, the picture or the close
 * button close it). Rendered as a button so it opens from the keyboard too.
 */
export default function NoteLightboxImage({ src, alt, className, width, height }: { src: string; alt: string; className?: string; width?: number; height?: number }) {
  const lang = useLocale()
  const [open, setOpen] = useState(false), small = useRef<HTMLImageElement>(null), from = useRef<DOMRect | null>(null)
  const name = alt || tr(lang, '이미지', '画像', 'Image')
  return <>
    <button type="button" className="note-image-button" aria-label={`${tr(lang, '이미지 크게 보기', '画像を拡大', 'View image larger')}: ${alt}`.replace(/: $/, '')} onClick={() => { from.current = small.current?.getBoundingClientRect() ?? null; setOpen(true) }}>
      <img ref={small} className={className} src={src} alt={alt} width={width} height={height} loading="lazy" />
    </button>
    <BaseModal open={open} onClose={() => setOpen(false)} title={name} maxWidth="96vw" padding="0.75rem" blur={false} backdrop="color-mix(in srgb, var(--bg-deep) 94%, transparent)" className="note-lightbox" zIndex={10000}>
      <div className="note-lightbox-frame">
        <button type="button" className="note-lightbox-close" aria-label={tr(lang, '닫기', '閉じる', 'Close')} onClick={() => setOpen(false)}><X size={20} /></button>
        <LargeImage src={src} alt={alt} from={from.current} onClose={() => setOpen(false)} />
      </div>
    </BaseModal>
  </>
}

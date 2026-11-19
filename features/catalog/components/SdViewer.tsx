'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Pause, Play, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import BaseModal from '@/components/ui/BaseModal'
import type { IdentitySpine, SpineForm } from '@/features/catalog/lib/spine-pack'
import segment from '@/styles/components/SinnerDetail.module.css'
import styles from '@/styles/components/SdViewer.module.css'

const SpineStage = dynamic(() => import('@/features/catalog/components/SpineStage'), { ssr: false })

interface Props {
  open: boolean
  onClose: () => void
  /** The identity's name: the title. */
  name: string
  sd: IdentitySpine
  form: SpineForm
  /** Changes when another form is picked, so the stage starts over. */
  formKey: number
  skins: (string | null)[]
  animation?: string
  /** Reduced motion: the figure starts paused. */
  still: boolean
  /** The form, skin and animation tabs. */
  children?: ReactNode
}

// What stands behind the figure. The colours are in the stylesheet, by data-backdrop.
const BACKDROPS = ['dark', 'black', 'white', 'clear'] as const
type Backdrop = (typeof BACKDROPS)[number]

const FIT = { zoom: 1, x: 0, y: 0 }
const MIN_ZOOM = 0.5
const MAX_ZOOM = 8

/** `view` zoomed by `factor` so that the point `at` (CSS pixels from the middle of the stage) stays where it is. */
function zoomed(view: typeof FIT, factor: number, at = { x: 0, y: 0 }) {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor))
  const by = zoom / view.zoom
  return { zoom, x: at.x - (at.x - view.x) * by, y: at.y - (at.y - view.y) * by }
}

/** The SD figure at full size: zoom and drag, pause, and pick what stands behind it. */
export default function SdViewer({ open, onClose, name, sd, form, formKey, skins, animation, still, children }: Props) {
  const t = useTranslations()
  const [view, setView] = useState(FIT)
  const [playing, setPlaying] = useState(!still)
  const [backdrop, setBackdrop] = useState<Backdrop>('dark')
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null)
  const fingers = useRef(new Map<number, { x: number; y: number }>())
  const label = t('identity.sd.label', { name })

  /** A pointer's place in CSS pixels from the middle of the stage. */
  const place = (event: { clientX: number; clientY: number }, stage: Element) => {
    const box = stage.getBoundingClientRect()
    return { x: event.clientX - box.left - box.width / 2, y: event.clientY - box.top - box.height / 2 }
  }

  // The wheel zooms at the cursor. React listens to the wheel passively, and a trackpad pinch would zoom the page.
  useEffect(() => {
    if (!stageEl) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const at = place(event, stageEl)
      setView(now => zoomed(now, Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015)), at))
    }
    stageEl.addEventListener('wheel', onWheel, { passive: false })
    return () => stageEl.removeEventListener('wheel', onWheel)
  }, [stageEl])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    fingers.current.set(event.pointerId, place(event, event.currentTarget))
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const before = fingers.current.get(event.pointerId)
    if (!before) return
    const now = place(event, event.currentTarget)
    const other = [...fingers.current].find(([id]) => id !== event.pointerId)?.[1]
    fingers.current.set(event.pointerId, now)
    if (!other) {
      // one finger or the mouse: drag
      setView(view => ({ ...view, x: view.x + now.x - before.x, y: view.y + now.y - before.y }))
      return
    }
    // two fingers: pinch about the point between them
    const spread = (a: typeof now, b: typeof now) => Math.hypot(a.x - b.x, a.y - b.y) || 1
    setView(view => zoomed(view, spread(now, other) / spread(before, other), { x: (now.x + other.x) / 2, y: (now.y + other.y) / 2 }))
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => { fingers.current.delete(event.pointerId) }

  return (
    <BaseModal open={open} onClose={onClose} title={label} maxWidth="min(58rem, calc(88dvh + 18rem))" sheet>
      <div className={`${styles.viewer} border`}>
        <div className={`popup-header ${styles.head}`}>
          <h2 className="min-w-0 line-clamp-2">{name}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        </div>

        <div
          ref={setStageEl}
          className={styles.stage}
          data-backdrop={backdrop}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => setView(FIT)}
        >
          <SpineStage key={formKey} pack={sd} form={form} skins={skins} animation={animation} paused={!playing} view={view} anchor="center"
            label={label} className="block h-full w-full" onError={onClose} />
        </div>

        <div className={styles.panel}>
          {children}

          <div className={styles.tools}>
            <div className={segment.segment} role="group" aria-label={t('identity.sd.zoom')}>
              <button type="button" aria-label={t('identity.sd.zoomOut')} disabled={view.zoom <= MIN_ZOOM} onClick={() => setView(now => zoomed(now, 1 / 1.25))}><ZoomOut size={18} /></button>
              <button type="button" className={styles.percent} aria-label={t('identity.sd.fit')} onClick={() => setView(FIT)}>{Math.round(view.zoom * 100)}%</button>
              <button type="button" aria-label={t('identity.sd.zoomIn')} disabled={view.zoom >= MAX_ZOOM} onClick={() => setView(now => zoomed(now, 1.25))}><ZoomIn size={18} /></button>
            </div>
            <div className={segment.segment}>
              <button type="button" aria-label={playing ? t('identity.viewer.pause') : t('identity.viewer.play')} onClick={() => setPlaying(now => !now)}>
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.group}>
            <span className={styles.groupTitle}>{t('identity.sd.backdrop')}</span>
            <div className={segment.segment} role="group" aria-label={t('identity.sd.backdrop')}>
              {BACKDROPS.map(key => (
                <button key={key} type="button" aria-pressed={backdrop === key} aria-label={t(`identity.sd.backdrops.${key}`)} onClick={() => setBackdrop(key)}>
                  <span className={styles.swatch} data-backdrop={key} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  )
}

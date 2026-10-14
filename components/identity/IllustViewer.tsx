'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { Pause, Play, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import StageSaveButtons from '@/components/spine/StageSaveButtons'
import type { SpineStageHandle } from '@/components/spine/SpineStage'
import type { IdentitySpine } from '@/lib/spine/pack'
import segment from '@/styles/components/SinnerDetail.module.css'

// The Spine runtime is only downloaded when an animated illustration is opened.
const SpineStage = dynamic(() => import('@/components/spine/SpineStage'), { ssr: false })

interface Props {
  onClose: () => void
  /** The identity's name: the picture's label and the saved file's name. */
  name: string
  /** The still illustration. It also stands in while the skeleton loads. */
  src: string
  /** The illustration as a skeleton: it plays over the still, and can be saved as a GIF or a video. */
  illust?: IdentitySpine | null
  /** The still could not be loaded. */
  onImageError: () => void
  /** The skeleton could not be drawn. */
  onStageError: () => void
}

/** The full illustration over the whole screen (through a portal: the page's entrance transform would trap it). */
export default function IllustViewer({ onClose, name, src, illust, onImageError, onStageError }: Props) {
  const t = useTranslations()
  const [playing, setPlaying] = useState(true)
  const handle = useRef<SpineStageHandle | null>(null)

  // The page behind does not scroll, and Escape closes.
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[110] flex cursor-pointer items-center justify-center" style={{ background: 'rgba(0,0,0,0.92)' }} onClick={onClose}>
      <button
        className="absolute right-4 top-4 z-10 rounded-full p-2 transition-colors hover:bg-white/10"
        style={{ color: '#aaa', cursor: 'pointer' }}
        onClick={onClose}
        aria-label={t('common.close')}
      >
        <X size={24} />
      </button>

      {illust ? (
        // The still shows until the skeleton has loaded; then the canvas fades in over it in the same 16:9 frame.
        <div className="relative aspect-video" style={{ width: 'min(100vw, calc((100dvh - 8rem) * 16 / 9))' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={src} src={src} alt="" className="absolute inset-0 h-full w-full object-contain" />
          <SpineStage pack={illust} form={illust.forms[0]} paused={!playing} handle={handle} label={name} className="absolute inset-0 block h-full w-full" onError={onStageError} />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={name}
          className="max-h-[calc(100dvh-8rem)] max-w-full object-contain"
          style={{ opacity: 0, transition: 'opacity 0.3s ease' }}
          onLoad={event => { event.currentTarget.style.opacity = '1' }}
          onError={onImageError}
        />
      )}

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 cursor-default items-center gap-2" onClick={event => event.stopPropagation()}>
        {illust && (
          <div className={segment.segment}>
            <button type="button" aria-label={playing ? t('identity.viewer.pause') : t('identity.viewer.play')} onClick={() => setPlaying(now => !now)}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
          </div>
        )}
        <StageSaveButtons handle={illust ? handle : undefined} image={src} name={name} colour="#000000" videoSide={1920} />
      </div>
    </div>,
    document.body,
  )
}

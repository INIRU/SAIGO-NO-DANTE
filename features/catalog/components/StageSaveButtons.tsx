'use client'

import { useState, type ReactNode, type RefObject } from 'react'
import { Film, ImageDown, Video } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { SpineStageHandle } from '@/features/catalog/components/SpineStage'
import { download, fileNameOf, imagePng, stageGif, stagePng, stageVideo } from '@/features/catalog/lib/spine-save'
import { showError, showSuccess } from '@/lib/toast'
import segment from '@/styles/components/SinnerDetail.module.css'

type Kind = 'png' | 'gif' | 'video'

interface Props {
  /** The stage to save from. Unset: only the still `image` can be saved, as a PNG. */
  handle?: RefObject<SpineStageHandle | null>
  /** A still picture to save when there is no stage. */
  image?: string
  /** The identity's name: the saved file's name. */
  name: string
  /** What stands behind a transparent figure. Null keeps PNG and GIF transparent. */
  colour: string | null
  /** The longest side of a saved video, in pixels. */
  videoSide: number
}

const GIF_SIDE = 480

/** PNG, GIF and video buttons for a Spine stage (or PNG alone for a still), with progress and a toast when done. */
export default function StageSaveButtons({ handle, image, name, colour, videoSide }: Props) {
  const t = useTranslations('identity.viewer')
  // what is being saved, and how far a recording has got (0–1)
  const [saving, setSaving] = useState<{ kind: Kind; done: number } | null>(null)

  const save = async (kind: Kind) => {
    if (saving) return
    setSaving({ kind, done: 0 })
    const file = fileNameOf(name)
    const recording = { stage: () => handle?.current ?? null, colour, onProgress: (done: number) => setSaving({ kind, done }) }
    try {
      const stage = handle?.current
      if (kind === 'png') {
        if (!stage && !image) throw new Error('Nothing to save')
        download(stage ? await stagePng(stage, colour) : await imagePng(image!), `${file}.png`)
      } else if (kind === 'gif') {
        download(await stageGif({ ...recording, side: GIF_SIDE }), `${file}.gif`)
      } else {
        const video = await stageVideo({ ...recording, side: videoSide })
        download(video.blob, `${file}.${video.extension}`)
      }
      showSuccess(t('saved'))
    } catch {
      showError(t('saveFailed'))
    } finally {
      setSaving(null)
    }
  }

  const button = (kind: Kind, label: string, icon: ReactNode) => (
    <button type="button" className="gap-1.5" disabled={!!saving} onClick={() => save(kind)}>
      {icon}
      {saving?.kind === kind && kind !== 'png' ? `${Math.round(saving.done * 100)}%` : label}
    </button>
  )

  return (
    <div className={segment.segment} role="group" aria-label={t('save')}>
      {button('png', 'PNG', <ImageDown size={16} aria-hidden />)}
      {handle && button('gif', 'GIF', <Film size={16} aria-hidden />)}
      {handle && button('video', t('video'), <Video size={16} aria-hidden />)}
    </div>
  )
}

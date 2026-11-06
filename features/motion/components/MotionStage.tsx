'use client'

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Hourglass, Info, Maximize, Minimize, Pause, Play, RotateCw, SlidersHorizontal, Smartphone, Volume2, VolumeX } from 'lucide-react'
import { useMotionFrame, type MotionChapter, type MotionError, type MotionFrameStore, type MotionMark, type MotionStatus, type MotionVolumes } from '@/features/motion/hooks/useSkillMotion'
import { useStageScreen } from '@/features/motion/hooks/useStageScreen'
import { motionChapterLabel, type MotionChapterWords } from '@/features/motion/lib/catalog'
import MotionTimeline, { currentChapter } from './MotionTimeline'
import styles from './Motion.module.css'

// Once per visit (the tab's session): a reload or another skill in the same visit does not ask again.
const NOTICE_KEY = 'motion-credit-notice'

// The counter and the seek bar change every frame: data-sentry-block keeps them out of the session replay, which otherwise
// records (and parses the style of) each change, 60 a second.
function FrameCounter({ store, frames }: { store: MotionFrameStore; frames: number }) {
  const frame = Math.max(0, useMotionFrame(store))
  return (
    <span data-sentry-block className="shrink-0 font-[family-name:var(--font-title)] text-[1rem] tabular-nums tracking-wide text-[var(--text-secondary)]">
      <span className="text-[var(--text-primary)]">{frame}</span> / {Math.max(0, frames - 1)}
    </span>
  )
}

/** The name of the chapter on screen, written only when the chapter changes. */
function ChapterName({ store, chapters, skillName }: { store: MotionFrameStore; chapters: readonly MotionChapter[]; skillName?: (skillId: number) => string | undefined }) {
  const t = useTranslations('motionPage')
  const chapter = currentChapter(chapters, Math.max(0, useMotionFrame(store)))
  if (!chapter) return null
  return <span className="ml-1.5 shrink-0 text-[0.8125rem] text-[var(--text-secondary)] @max-md:hidden">{motionChapterLabel(chapter, t.raw('chapters') as MotionChapterWords, skillName)}</span>
}

/**
 * The sound settings over the bar's right end: the master, voice and effects volumes (each sound at once, also while
 * muted). It stays in the page while closed (hidden), so the sliders keep their place.
 */
function VolumePanel({ id, open, volumes, onVolume }: {
  id: string; open: boolean; volumes: MotionVolumes; onVolume: (kind: keyof MotionVolumes, value: number) => void
}) {
  const t = useTranslations('motionPage')
  const rows = [['master', 'volumeMaster'], ['voice', 'volumeVoice'], ['sfx', 'volumeSfx']] as const
  return (
    <div id={id} hidden={!open} className={`${styles.volumePanel} absolute bottom-full right-1.5 z-[3] mb-1.5 w-[15.5rem] rounded-lg border border-[#5a4526] bg-[rgba(18,14,9,0.96)] px-3.5 py-3 shadow-[0_1rem_2.5rem_rgba(0,0,0,0.6)]`}>
      {rows.map(([kind, key]) => (
        <label key={kind} className="grid grid-cols-[3.75rem_minmax(0,1fr)_2.25rem] items-center gap-2 py-1 text-[0.8125rem] text-[var(--text-secondary)]">
          <span>{t(key)}</span>
          <input type="range" min={0} max={1} step={0.05} value={volumes[kind]} aria-label={t(key)}
            onChange={event => onVolume(kind, Number(event.target.value))}
            className={`${styles.seek} h-7 w-full cursor-pointer`} style={{ ['--fill' as string]: `${volumes[kind] * 100}%` }} />
          <span className="text-right font-[family-name:var(--font-title)] tabular-nums text-[var(--text-primary)]">{Math.round(volumes[kind] * 100)}</span>
        </label>
      ))}
    </div>
  )
}

const iconButton = 'h-10 w-10 shrink-0 place-items-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[rgba(200,144,10,0.08)] hover:text-[var(--gold-light)] disabled:pointer-events-none disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]'

/**
 * The 16:9 stage the compositor draws into, with a notice over the picture once a visit (the motion is Project Moon's work
 * and may differ from the game), which holds playback until it is dismissed; the credit itself is in the picture. Under it
 * the controls: play, a frame back and forward, the timeline, the chapter and frame counter, the sound, its volume panel
 * (master, voice and effects; Web Audio, so the iPhone follows it too) and the full screen (on a phone held upright, also
 * landscape). On a narrow stage the timeline takes its own row above the buttons.
 */
/**
 * The Project Moon notice of this visit: null until the browser says whether the visit has seen it (nothing shows, so a
 * reload does not flash it), then shown until dismissed. The page holds playback until it is dismissed (`notice !== false`).
 */
export function useCreditNotice(): [notice: boolean | null, dismiss: () => void] {
  const [notice, setNotice] = useState<boolean | null>(null)
  useEffect(() => {
    let seen = false
    try { seen = sessionStorage.getItem(NOTICE_KEY) === '1' } catch { /* storage blocked: asked every time */ }
    setNotice(!seen)
  }, [])
  const dismiss = useCallback(() => {
    setNotice(false)
    try { sessionStorage.setItem(NOTICE_KEY, '1') } catch { /* storage blocked: asked again next time */ }
  }, [])
  return [notice, dismiss]
}

/** The stage of a new identity the index has no motion for yet: the same frame, with when to expect it. */
export function MotionPendingStage() {
  const t = useTranslations('motionPage')
  return (
    <div className="grid aspect-video place-items-center overflow-hidden rounded-lg border border-[#2e2417] bg-[#050403] p-6 text-center">
      <div className="flex max-w-[26rem] flex-col items-center gap-2">
        <Hourglass className="h-7 w-7 text-[var(--gold-light)]" aria-hidden="true" />
        <p className="font-[family-name:var(--font-heading)] text-[1rem] text-[var(--text-primary)] sm:text-[1.125rem]">{t('pendingTitle')}</p>
        <p className="break-keep text-[0.8125rem] leading-relaxed text-[var(--text-secondary)] sm:text-[0.875rem]">{t('pendingBody')}</p>
      </div>
    </div>
  )
}

export default function MotionStage({ hostRef, status, error, playing, muted, volumes, hasAudio, frames, frameStore, chapters = [], marks = [], skillName, onTogglePlay, onStep, onSeek, onToggleMute, onVolume, onRetry, notice, onDismiss }: {
  hostRef: RefObject<HTMLDivElement | null>
  status: MotionStatus
  error: MotionError | null
  playing: boolean
  muted: boolean
  volumes: MotionVolumes
  hasAudio: boolean
  frames: number
  frameStore: MotionFrameStore
  chapters?: readonly MotionChapter[]
  marks?: readonly MotionMark[]
  /** A skill's name by id, for the chapters on the timeline. */
  skillName?: (skillId: number) => string | undefined
  onTogglePlay: () => void
  onStep: (delta: number) => void
  onSeek: (frame: number) => void
  onToggleMute: () => void
  onVolume: (kind: keyof MotionVolumes, volume: number) => void
  onRetry: () => void
  /** The notice of this visit (useCreditNotice): the controls stay off until it is dismissed (false). */
  notice: boolean | null
  onDismiss: () => void
}) {
  const t = useTranslations('motionPage')
  const ready = status === 'ready' && notice === false
  // A frame step or the seek bar pauses to look at a frame: the middle play button stays away until it plays again.
  // (The video pauses a moment after the step, so the mark clears only when playback starts again.)
  const [scrubbing, setScrubbing] = useState(false)
  const [wasPlaying, setWasPlaying] = useState(playing)
  if (playing !== wasPlaying) {
    setWasPlaying(playing)
    if (playing) setScrubbing(false)
  }
  const step = (delta: number) => { setScrubbing(true); onStep(delta) }
  const seek = (n: number) => { setScrubbing(true); onSeek(n) }
  const centerPlay = ready && !playing && !scrubbing && !notice
  const rootRef = useRef<HTMLDivElement>(null)
  const view = useStageScreen(rootRef)
  // The volume panel closes on a press outside it and its button, and on Escape.
  const [volumeOpen, setVolumeOpen] = useState(false)
  const volumeRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  useEffect(() => {
    if (!volumeOpen) return
    const outside = (event: PointerEvent) => { if (!volumeRef.current?.contains(event.target as Node)) setVolumeOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setVolumeOpen(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [volumeOpen])
  // Full screen: the root covers the screen (or is the browser's full screen element, which may not be turned), and the
  // frame inside it fills it, or lies a quarter turned across a phone held upright.
  const frame = !view.full ? 'overflow-hidden rounded-lg border border-[#2e2417]'
    : view.turned ? 'absolute left-1/2 top-1/2 flex h-[100dvw] w-[100dvh] -translate-x-1/2 -translate-y-1/2 rotate-90 flex-col'
    : 'absolute inset-0 flex flex-col'

  return (
    <div ref={rootRef} className={view.full ? 'fixed inset-0 z-[110] bg-black' : undefined}>
    <div className={`${frame} @container bg-[#050403]`}>
      <div className={`relative w-full select-none bg-black ${view.full ? 'min-h-0 flex-1' : 'aspect-video'}`}>
        <div ref={hostRef} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full [&>canvas]:object-contain" onClick={ready ? onTogglePlay : undefined} />

        {/* The bar's play button is the one assistive technology reads; this one is a bigger target over the picture. */}
        <button type="button" data-center-play tabIndex={-1} aria-hidden="true" onClick={onTogglePlay}
          className={`absolute left-1/2 top-1/2 z-[1] grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[rgba(232,176,48,0.45)] bg-[rgba(5,4,3,0.6)] text-[var(--gold-light)] shadow-[0_0.5rem_1.5rem_rgba(0,0,0,0.5)] transition-[opacity,scale,background-color] duration-200 hover:bg-[rgba(42,31,12,0.85)] motion-reduce:transition-none sm:h-20 sm:w-20 ${centerPlay ? 'scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0'}`}>
          <Play className="ml-1 h-7 w-7 fill-current sm:h-9 sm:w-9" aria-hidden="true" />
        </button>

        {status === 'loading' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[rgba(5,4,3,0.35)]">
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-[rgba(232,176,48,0.25)] border-t-[var(--gold-light)] motion-reduce:animate-none" aria-hidden="true" />
          </div>
        )}

        {status === 'error' && (
          <div role="alert" className="absolute inset-0 grid place-items-center bg-[rgba(5,4,3,0.85)] p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <p className="text-[0.9375rem] text-[var(--text-primary)]">{error === 'webgl' ? t('webglError') : t('loadError')}</p>
              {error === 'load' && (
                <button type="button" onClick={onRetry} className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--gold-dim)] bg-[#2a1f0c] px-4 text-[0.875rem] font-semibold text-[var(--gold-light)] hover:bg-[#35270e]">
                  <RotateCw className="h-4 w-4" aria-hidden="true" />{t('retry')}
                </button>
              )}
            </div>
          </div>
        )}

        {notice && (
          <div className="absolute inset-0 z-[2] grid place-items-center bg-[rgba(5,4,3,0.62)] p-2 sm:p-4">
            <div role="dialog" aria-modal="false" aria-labelledby="motion-notice-title"
              className={`${styles.notice} w-full max-w-[24rem] rounded-lg border border-[#5a4526] bg-[rgba(18,14,9,0.94)] px-4 py-3 text-center sm:p-5 shadow-[0_1rem_3rem_rgba(0,0,0,0.6)]`}>
              <Info className="mx-auto mb-2 h-6 w-6 text-[var(--gold-light)] max-sm:hidden" aria-hidden="true" />
              <p id="motion-notice-title" className="font-[family-name:var(--font-heading)] text-[0.9375rem] text-[var(--text-primary)] sm:text-[1.0625rem]">{t('noticeTitle')}</p>
              <p className="mt-1 break-keep text-[0.8125rem] leading-snug text-[var(--text-secondary)] sm:mt-2 sm:text-[0.875rem] sm:leading-relaxed">{t('noticeBody')}</p>
              <button type="button" onClick={onDismiss} autoFocus
                className="mt-2.5 inline-flex h-9 min-w-[6rem] sm:mt-4 sm:h-10 items-center justify-center rounded-md border border-[var(--gold-dim)] bg-[#2a1f0c] px-4 text-[0.875rem] font-semibold text-[var(--gold-light)] transition-colors hover:bg-[#35270e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
                {t('noticeOk')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="relative flex flex-wrap items-center gap-1 border-t border-[#2e2417] bg-[var(--bg-panel)] px-1.5 py-1 @md:flex-nowrap @md:gap-1.5 @md:px-2">
        <button type="button" className={`${iconButton} grid`} onClick={onTogglePlay} disabled={!ready} aria-label={playing ? t('pause') : t('play')}>
          {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
        </button>
        <button type="button" className={`${iconButton} grid @max-md:hidden`} onClick={() => step(-1)} disabled={!ready} aria-label={t('prevFrame')}><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
        <button type="button" className={`${iconButton} grid @max-md:hidden`} onClick={() => step(1)} disabled={!ready} aria-label={t('nextFrame')}><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
        <MotionTimeline store={frameStore} frames={ready ? frames : 0} chapters={chapters} marks={marks} label={t('frame')} onSeek={seek} />
        <ChapterName store={frameStore} chapters={chapters} skillName={skillName} />
        <FrameCounter store={frameStore} frames={frames} />
        <button type="button" className={`${iconButton} grid @max-md:ml-auto`} onClick={onToggleMute} disabled={!ready || !hasAudio} aria-label={muted ? t('soundOn') : t('soundOff')} aria-pressed={!muted}>
          {muted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
        </button>
        <div ref={volumeRef} className="contents">
          <button type="button" className={`${iconButton} grid`} onClick={() => setVolumeOpen(!volumeOpen)} disabled={!ready || !hasAudio}
            aria-label={t('volume')} aria-expanded={volumeOpen} aria-controls={panelId} data-open={volumeOpen || undefined}>
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          </button>
          <VolumePanel id={panelId} open={volumeOpen && ready && hasAudio} volumes={volumes} onVolume={onVolume} />
        </div>
        <button type="button" className={`${iconButton} hidden max-sm:pointer-coarse:grid`} onClick={() => void (view.turned ? view.close() : view.open(true))}
          aria-label={view.turned ? t('portrait') : t('landscape')}>
          <Smartphone className={`h-5 w-5 transition-transform ${view.turned ? '' : 'rotate-90'}`} aria-hidden="true" />
        </button>
        <button type="button" className={`${iconButton} grid`} onClick={() => void (view.full ? view.close() : view.open(false))}
          aria-label={view.full ? t('exitFullscreen') : t('fullscreen')}>
          {view.full ? <Minimize className="h-5 w-5" aria-hidden="true" /> : <Maximize className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
    </div>
    </div>
  )
}

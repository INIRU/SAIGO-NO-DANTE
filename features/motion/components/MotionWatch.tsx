'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { parseAsString, useQueryStates } from 'nuqs'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Check, ChevronDown, Link2 } from 'lucide-react'
import BackLink from '@/components/navigation/BackLink'
import QuietImage from '@/components/ui/QuietImage'
import { useCutinAllies, useMotionCatalog } from '@/features/motion/hooks/useMotionCatalog'
import { readMotionVoiceLinks, useSkillMotion } from '@/features/motion/hooks/useSkillMotion'
import { defaultMotionState, findMotionSkill, isMotionEgo, toMotionParam as toParam, type MotionIdentity, type MotionSkill } from '@/features/motion/lib/catalog'
import { useRouter } from '@/lib/i18n/navigation'
import { showError } from '@/lib/toast'
import MotionScenarios from './MotionScenarios'
import MotionSkillStrip, { motionSkillIcon } from './MotionSkillStrip'
import MotionStage, { MotionPendingStage, useCreditNotice } from './MotionStage'
import MotionSidePanel from './MotionSidePanel'
import AdSlot from '@/components/ads/AdSlot'
import { MotionWatchSkeleton } from './SkillMotionSkeleton'

const QUERY = { skill: parseAsString, state: parseAsString }
const QUERY_OPTIONS = { history: 'replace', shallow: true, scroll: false } as const
const iconButton = 'hit-target inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[rgba(200,144,10,0.08)] hover:text-[var(--gold-light)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]'

/** The address of what is on screen, condition included, for anyone to open. */
function CopyLink() {
  const t = useTranslations('motionPage')
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { showError(t('copyLinkFailed')) }
  }
  return (
    <button type="button" onClick={() => void copy()} aria-label={copied ? t('linkCopied') : t('copyLink')} title={copied ? t('linkCopied') : t('copyLink')} className={`${iconButton} ml-auto`}>
      {copied ? <Check className="h-5 w-5 text-[var(--gold-light)]" aria-hidden="true" /> : <Link2 className="h-5 w-5" aria-hidden="true" />}
    </button>
  )
}

function Header({ back, image, title }: { back: string; image: string | null; title: string }) {
  const t = useTranslations('motionPage')
  return (
    <header className="flex shrink-0 items-center gap-2">
      <BackLink parent href={back} aria-label={t('back')} title={t('back')} className={`${iconButton} -ml-2`}><ArrowLeft className="h-5 w-5" aria-hidden="true" /></BackLink>
      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-[#2e2417] bg-[#0a0806]">{image && <QuietImage src={image} alt="" fill sizes="2.75rem" className="object-cover object-[50%_12%]" />}</span>
      <h1 className="min-w-0 truncate font-[family-name:var(--font-heading)] text-[1.125rem] leading-tight text-[var(--text-primary)] md:text-[1.375rem]">{title}</h1>
      <CopyLink />
    </header>
  )
}

/**
 * The watching page: one stage, its timeline, the skill frames and the scenarios of the chosen skill. A skill and a scenario
 * live in the address, changed without a navigation, so a link opens the same video. A skill the index does not have goes
 * back to the picking page; a new identity without motion yet says when to expect it.
 */
export default function MotionWatch() {
  const t = useTranslations('motionPage')
  const router = useRouter()
  const { sinners, error, skillNames, partner } = useMotionCatalog()
  const voiceLinks = useSWR('motion-voice-links', readMotionVoiceLinks, { revalidateOnFocus: false })
  const [query, setQuery] = useQueryStates(QUERY, QUERY_OPTIONS)
  const motion = useSkillMotion()
  const [notice, dismissNotice] = useCreditNotice()
  const [info, setInfo] = useState(false)

  const found = useMemo(() => (sinners && query.skill ? findMotionSkill(sinners, query.skill) : null), [sinners, query.skill])
  const pending = useMemo(() => {
    for (const sinner of sinners ?? []) for (const identity of sinner.identities) if (identity.pending && identity.slug === query.skill) return { sinnerId: sinner.id, identity }
    return undefined
  }, [sinners, query.skill])
  const skill = found?.skill
  const state = skill ? skill.states.find(s => s.state === query.state) ?? skill.states.find(s => s.state === defaultMotionState(skill)) : undefined

  const ownGameId = found && !isMotionEgo(found.owner) ? found.owner.gameId : null
  const cutinAllies = useCutinAllies(skill?.key, skill?.states, ownGameId, partner)
  const skillName = useCallback((id: number) => (id === skill?.skillId ? skill.title : skillNames.get(id)), [skill, skillNames])

  const lost = (Boolean(sinners) && !found && !pending) || (Boolean(error) && !sinners)
  useEffect(() => { if (lost) router.replace('/motion/skills') }, [lost, router])

  // Load whenever the chosen video (skill or scenario) changes, from its first frame.
  const loaded = useRef<string | null>(null)
  const { load, hold } = motion
  // Nothing plays until the notice of this visit is dismissed, nor while a pending identity is shown.
  useEffect(() => { hold(notice !== false || Boolean(pending)) }, [notice, pending, hold])
  useEffect(() => {
    if (!state || loaded.current === state.video) return
    loaded.current = state.video
    void load(state)
  }, [state, load])

  const shell = 'mx-auto flex min-h-[100dvh] w-full max-w-[90rem] flex-col gap-3 px-4 pb-24 pt-3 md:pb-6 lg:h-[100dvh] lg:pb-4'
  if (pending) {
    const identity: MotionIdentity = pending.identity
    return (
      <div className={shell}>
        <Header back={`/motion/skills?sinner=${pending.sinnerId}`} image={identity.portrait} title={identity.label} />
        <div className="mx-auto w-full max-w-[60rem]"><MotionPendingStage /></div>
      </div>
    )
  }
  if (!found || !skill || !state) return <div className={shell}><MotionWatchSkeleton /></div>

  const { sinnerId, owner } = found
  const ego = 'egoId' in owner
  const image = ego ? owner.image : owner.portrait
  // An E.G.O skill has no sprite of its own: the game shows the E.G.O's art in the frame, its corrosion art for the corrosion.
  const icon = (s: MotionSkill) => (ego ? ((s.erode ? owner.image?.replace('_awaken_profile', '_erosion_profile') : owner.image) ?? '') : motionSkillIcon(sinnerId, s.frame?.sprite ?? s.skillId))
  const gameId = ego ? null : owner.gameId
  const voices = voiceLinks.data?.filter(line => gameId && line.identities.includes(gameId)) ?? []

  return (
    <div className={shell}>
      <Header back={`/motion/skills?sinner=${sinnerId}${ego ? '&tab=ego' : ''}`} image={image} title={owner.label} />
      <div className="grid min-h-0 flex-1 gap-x-5 gap-y-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          {/* The stage is never taller than the screen leaves it (a short laptop keeps the skill frames in view). */}
          <div className="mx-auto w-full lg:max-w-[calc((100dvh-13.5rem)*16/9)]">
            <MotionStage
              hostRef={motion.hostRef} status={motion.status} error={motion.error} playing={motion.playing} muted={motion.muted} volumes={motion.volumes}
              hasAudio={motion.hasAudio} frames={motion.frames} frameStore={motion.frameStore} chapters={motion.chapters} marks={motion.marks} skillName={skillName}
              onTogglePlay={motion.togglePlay} onStep={motion.step} onSeek={motion.seek} onToggleMute={motion.toggleMute} onVolume={motion.setVolume}
              onRetry={() => void load(state)} notice={notice} onDismiss={dismissNotice} />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 sm:flex-nowrap">
            <MotionSkillStrip icon={icon} skills={owner.skills} selectedKey={skill.key} onPick={next => void setQuery({ skill: toParam(next.key), state: null })} />
            <div className="min-w-0">
              {ego && <p className="text-[0.8125rem] leading-tight text-[var(--gold-light)]">{t(skill.erode ? 'erode' : 'awaken')}</p>}
              <h2 className="break-keep font-[family-name:var(--font-heading)] text-[1rem] leading-snug text-[var(--text-primary)] md:text-[1.125rem]">{skill.title}</h2>
            </div>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          <section aria-labelledby="motion-scenarios">
            <h2 id="motion-scenarios" className="mb-1 px-3 pt-1 font-[family-name:var(--font-heading)] text-[1rem] text-[var(--gold)]">{t('scenarios')}</h2>
            <MotionScenarios key={skill.key} states={skill.states} current={state.state} allies={cutinAllies}
              onPick={next => void setQuery({ skill: toParam(skill.key), state: next })}
              voices={voices} onVoice={motion.playVoice} onVoiceStop={motion.stopVoice} />
          </section>
          <details className="group border-t border-[#2e2417]" onToggle={event => setInfo(event.currentTarget.open)}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md px-3 text-[0.9375rem] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] [&::-webkit-details-marker]:hidden">
              {t('skillInfo')}<ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            {info && <div className="pt-2"><MotionSidePanel skillId={skill.skillId} icon={ego ? icon(skill) : undefined} /></div>}
          </details>
          <AdSlot place="panel" />
        </aside>
      </div>
    </div>
  )
}

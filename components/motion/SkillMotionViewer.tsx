'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { parseAsString, useQueryStates } from 'nuqs'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronDown, RotateCw } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import QuietImage from '@/components/ui/QuietImage'
import { useSkillMotion } from '@/hooks/useSkillMotion'
import { defaultMotionState, type MotionIdentity, type MotionSinner, type MotionSkill } from '@/lib/motion/catalog'
import MotionConditions from './MotionConditions'
import MotionPicker from './MotionPicker'
import MotionSkillStrip from './MotionSkillStrip'
import MotionStage from './MotionStage'
import MotionSidePanel from './MotionSidePanel'
import SkillMotionSkeleton from './SkillMotionSkeleton'

type Pick = { sinnerId: string; identity: MotionIdentity; skill: MotionSkill }

const readCatalog = async (url: string): Promise<MotionSinner[]> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  return (await response.json()).sinners
}

// The address names a skill as "<slug>~<skill id>" ("|" of the internal key reads badly in a URL).
const toParam = (key: string) => key.replace('|', '~')
const fromParam = (param: string) => param.replace('~', '|')
const QUERY = { skill: parseAsString, state: parseAsString }
const QUERY_OPTIONS = { history: 'replace', shallow: true, scroll: false } as const

/**
 * The skill motion page: pick a sinner → identity in the list (on the left from lg up, a sheet on a phone), then under the
 * stage the identity's skill (its sprites) and the skill's condition (text choices, link partners as portraits); the effect
 * switches and the skill card beside it. The chosen skill and condition live in the address, so a link opens the same motion.
 */
export default function SkillMotionViewer() {
  const lang = useLocale()
  const t = useTranslations('motionPage')
  const { data: sinners, error, mutate } = useSWR(`/api/motion/catalog?lang=${lang}`, readCatalog, { revalidateOnFocus: false })
  const [query, setQuery] = useQueryStates(QUERY, QUERY_OPTIONS)
  const [tab, setTab] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const motion = useSkillMotion()

  const byKey = useMemo(() => {
    const map = new Map<string, Pick>()
    for (const sinner of sinners ?? []) for (const identity of sinner.identities) for (const skill of identity.skills) map.set(skill.key, { sinnerId: sinner.id, identity, skill })
    return map
  }, [sinners])
  const first = sinners?.[0]?.identities[0]?.skills[0]
  const picked = (query.skill ? byKey.get(fromParam(query.skill)) : undefined) ?? (first ? byKey.get(first.key) : undefined)
  const state = picked ? picked.skill.states.find(s => s.state === query.state) ?? picked.skill.states.find(s => s.state === defaultMotionState(picked.skill)) : undefined

  // Load whenever the chosen video changes; a change of condition within one skill keeps the time and play state.
  const loadedKey = useRef<string | null>(null)
  const loadedState = useRef<string | null>(null)
  const { load, current } = motion
  useEffect(() => {
    if (!picked || !state) return
    if (loadedKey.current === picked.skill.key && loadedState.current === state.state) return
    const keep = loadedKey.current === picked.skill.key ? current() : null
    loadedKey.current = picked.skill.key
    loadedState.current = state.state
    void load(state, keep)
  }, [picked, state, load, current])

  // An identity alone opens its first skill (the one playing when it is already chosen).
  const choose = (sinnerId: string, identity: MotionIdentity, skill?: MotionSkill) => {
    setTab(sinnerId)
    setSheet(false)
    const next = skill ?? identity.skills.find(s => s.key === picked?.skill.key) ?? identity.skills[0]
    if (next && next.key !== picked?.skill.key) void setQuery({ skill: toParam(next.key), state: null })
  }

  if (error && !sinners) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-[#2e2417] bg-[var(--bg-panel)] px-6 py-16 text-center">
        <p className="text-[0.9375rem] text-[var(--text-primary)]">{t('listError')}</p>
        <button type="button" onClick={() => void mutate()} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#8a6010] bg-[#2a1f0c] px-4 text-[0.875rem] font-semibold text-[var(--gold-light)] hover:bg-[#35270e]">
          <RotateCw className="h-4 w-4" aria-hidden="true" />{t('retry')}
        </button>
      </div>
    )
  }
  if (!sinners || !picked || !state) return <SkillMotionSkeleton />

  const picker = <MotionPicker sinners={sinners} sinnerId={tab ?? picked.sinnerId} selectedKey={picked.skill.key} onSinner={setTab} onPick={choose} />

  return (
    // From lg the page is the viewport's height (the layout) and each column scrolls on its own: the list; the stage with the
    // side panel under it (lg), or the stage and the side panel side by side (xl, where their wrapper steps aside).
    <div className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
      <aside className="hidden min-h-0 overflow-y-auto overscroll-contain pr-1 lg:block">
        {picker}
      </aside>

      <div className="flex min-w-0 flex-col gap-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 xl:contents">
      <div className="flex min-w-0 flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
        <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog"
          className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-2 text-left transition-colors active:bg-[var(--bg-elevated)] lg:hidden">
          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-[#2e2417] bg-[#0a0806]">
            {picked.identity.portrait && <QuietImage src={picked.identity.portrait} alt="" fill sizes="2.75rem" className="object-cover object-[50%_12%]" />}
          </span>
          <span className="line-clamp-2 min-w-0 flex-1 text-[0.9375rem] leading-snug text-[var(--text-primary)]">{picked.identity.label}</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-[var(--gold-light)]" aria-hidden="true" />
        </button>

        <MotionStage
          hostRef={motion.hostRef} status={motion.status} error={motion.error} playing={motion.playing} muted={motion.muted} volume={motion.volume}
          hasAudio={motion.hasAudio} frames={motion.frames} frameStore={motion.frameStore}
          onTogglePlay={motion.togglePlay} onStep={motion.step} onSeek={motion.seek} onToggleMute={motion.toggleMute} onVolume={motion.setVolume}
          onRetry={() => { loadedKey.current = null; void load(state, null) }} />

        <div className="flex flex-col gap-4">
          <MotionSkillStrip sinnerId={picked.sinnerId} skills={picked.identity.skills} selectedKey={picked.skill.key} onPick={skill => choose(picked.sinnerId, picked.identity, skill)} />
          <h2 className="-mt-1 break-keep font-[family-name:var(--font-heading)] text-[1.125rem] leading-snug text-[var(--text-primary)] md:text-[1.25rem]">{picked.skill.title}</h2>
          {picked.skill.states.length > 1 && (
            <MotionConditions key={picked.skill.key} states={picked.skill.states} current={state.state}
              onPick={next => void setQuery({ skill: toParam(picked.skill.key), state: next })} />
          )}
        </div>
      </div>

      <aside className="min-w-0 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
        <MotionSidePanel skillId={picked.skill.skillId} layers={motion.layers} onLayer={motion.setLayer} />
      </aside>
      </div>

      <BaseModal open={sheet} onClose={() => setSheet(false)} title={t('title')} sheet maxWidth="32rem" className="max-h-[85dvh] overflow-y-auto">
        {picker}
      </BaseModal>
    </div>
  )
}

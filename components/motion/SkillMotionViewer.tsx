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
import MotionPicker from './MotionPicker'
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
 * The skill motion page: pick a sinner → identity → skill (a list on the left from lg up, a sheet on a phone), watch it
 * on the stage with its conditions under it, and the skill card and the effect switches beside it. The chosen skill and
 * condition live in the address, so a link opens the same motion.
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

  const choose = (sinnerId: string, _identity: MotionIdentity, skill: MotionSkill) => {
    setTab(sinnerId)
    setSheet(false)
    void setQuery({ skill: toParam(skill.key), state: null })
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
    <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
      <aside className="hidden lg:row-span-2 lg:block xl:row-span-1">
        <div className="sticky top-[calc(var(--nav-offset)+1rem)] max-h-[calc(100dvh-var(--nav-offset)-2rem)] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] transition-[top] duration-300">
          {picker}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog"
          className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-2 text-left lg:hidden">
          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-[#2e2417] bg-[#0a0806]">
            {picked.identity.portrait && <QuietImage src={picked.identity.portrait} alt="" fill sizes="2.75rem" className="object-cover object-[50%_12%]" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.8125rem] text-[var(--text-secondary)]">{picked.identity.label}</span>
            <span className="block truncate text-[0.9375rem] text-[var(--text-primary)]">{picked.skill.title}</span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-[var(--gold-light)]" aria-hidden="true" />
        </button>

        <MotionStage
          hostRef={motion.hostRef} status={motion.status} error={motion.error} playing={motion.playing} muted={motion.muted} volume={motion.volume}
          hasAudio={motion.hasAudio} frames={motion.frames} frameStore={motion.frameStore}
          onTogglePlay={motion.togglePlay} onStep={motion.step} onSeek={motion.seek} onToggleMute={motion.toggleMute} onVolume={motion.setVolume}
          onRetry={() => { loadedKey.current = null; void load(state, null) }} />

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[0.8125rem] text-[var(--text-secondary)]">{picked.identity.label}</p>
            <h2 className="mt-0.5 break-keep font-[family-name:var(--font-heading)] text-[1.125rem] leading-snug text-[var(--text-primary)] md:text-[1.25rem]">{state.name}</h2>
          </div>
          {picked.skill.states.length > 1 && (
            <div role="radiogroup" aria-label={t('states')} className="flex flex-wrap gap-1.5">
              {picked.skill.states.map(option => {
                const active = option.state === state.state
                return (
                  <button key={option.state} type="button" role="radio" aria-checked={active} title={option.label}
                    onClick={() => void setQuery({ skill: toParam(picked.skill.key), state: option.state })}
                    className={`max-w-full truncate rounded-full border px-3 py-1.5 text-[0.8125rem] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] ${active ? 'border-[var(--gold)] bg-[#2a1f0c] font-semibold text-[var(--gold-light)]' : 'border-[#3a2a15] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:border-[#5a4526] hover:text-[var(--text-primary)]'}`}>
                    {option.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="min-w-0 lg:col-start-2 xl:col-start-auto">
        <MotionSidePanel skillId={picked.skill.skillId} layers={motion.layers} onLayer={motion.setLayer} />
      </aside>

      <BaseModal open={sheet} onClose={() => setSheet(false)} title={t('title')} sheet maxWidth="32rem" className="max-h-[85dvh] overflow-y-auto">
        {picker}
      </BaseModal>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { parseAsString, useQueryStates } from 'nuqs'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronDown, RotateCw } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import QuietImage from '@/components/ui/QuietImage'
import { useSkillMotion } from '@/hooks/useSkillMotion'
import { MOTION_INDEX_URL, defaultMotionState, fromMotionParam as fromParam, motionCatalogFrom, toMotionParam as toParam, type MotionEntry, type MotionIdentity, type MotionSiteData, type MotionSkill } from '@/lib/motion/catalog'
import MotionConditions from './MotionConditions'
import MotionPicker from './MotionPicker'
import MotionSkillStrip from './MotionSkillStrip'
import MotionStage, { MotionPendingStage, useCreditNotice } from './MotionStage'
import MotionSidePanel from './MotionSidePanel'
import SkillMotionSkeleton from './SkillMotionSkeleton'

type Pick = { sinnerId: string; identity: MotionIdentity; skill: MotionSkill }

const readJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}
const readSiteData = (url: string) => readJson<MotionSiteData>(url)
// The index changes with every upload: asked again on every page open, the browser checking its copy with R2 (304 when the same).
const readIndex = (url: string) => readJson<MotionEntry[]>(url, { cache: 'no-cache' })

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
  // The R2 index (read by the browser itself, so a new video shows on the next page open) and the site's names for it.
  const site = useSWR(`/api/motion/site-data?lang=${lang}`, readSiteData, { revalidateOnFocus: false })
  const index = useSWR(MOTION_INDEX_URL, readIndex, { revalidateOnFocus: false })
  const sinners = useMemo(() => site.data && index.data ? motionCatalogFrom(index.data, site.data, lang, new Date()) : undefined, [site.data, index.data, lang])
  const error = site.error ?? index.error
  const mutate = () => Promise.all([site.mutate(), index.mutate()])
  const [query, setQuery] = useQueryStates(QUERY, QUERY_OPTIONS)
  const [tab, setTab] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const motion = useSkillMotion()
  const [notice, dismissNotice] = useCreditNotice()

  const byKey = useMemo(() => {
    const map = new Map<string, Pick>()
    for (const sinner of sinners ?? []) for (const identity of sinner.identities) for (const skill of identity.skills) map.set(skill.key, { sinnerId: sinner.id, identity, skill })
    return map
  }, [sinners])
  // The first skill of the list (the newest identity may be a pending one, with none).
  const first = sinners?.flatMap(sinner => sinner.identities).flatMap(identity => identity.skills)[0]
  const picked = (query.skill ? byKey.get(fromParam(query.skill)) : undefined) ?? (first ? byKey.get(first.key) : undefined)
  // A new identity without motion yet, chosen by its slug: the stage says when to expect it.
  const pending = useMemo(() => {
    for (const sinner of sinners ?? []) for (const identity of sinner.identities) if (identity.pending && identity.slug === query.skill) return { sinnerId: sinner.id, identity }
    return undefined
  }, [sinners, query.skill])
  const isPending = Boolean(pending)
  const state = picked ? picked.skill.states.find(s => s.state === query.state) ?? picked.skill.states.find(s => s.state === defaultMotionState(picked.skill)) : undefined

  // Load whenever the chosen video (skill or condition) changes, from its first frame.
  const loaded = useRef<string | null>(null)
  const { load, hold } = motion
  // Nothing plays until the Project Moon notice of this visit is dismissed, nor while a pending identity is shown.
  useEffect(() => { hold(notice !== false || isPending) }, [notice, isPending, hold])
  useEffect(() => {
    // A pending identity has no stage: the skill is loaded again when one is chosen.
    if (isPending) { loaded.current = null; return }
    if (!state || loaded.current === state.video) return
    loaded.current = state.video
    void load(state)
  }, [state, load, isPending])

  // An identity alone opens its first skill (the one playing when it is already chosen); a pending one, its notice.
  const choose = (sinnerId: string, identity: MotionIdentity, skill?: MotionSkill) => {
    setTab(sinnerId)
    setSheet(false)
    if (identity.pending) {
      if (query.skill !== identity.slug) void setQuery({ skill: identity.slug, state: null })
      return
    }
    const next = skill ?? identity.skills.find(s => s.key === picked?.skill.key) ?? identity.skills[0]
    if (next && (isPending || next.key !== picked?.skill.key)) void setQuery({ skill: toParam(next.key), state: null })
  }

  if (error && !sinners) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-[#2e2417] bg-[var(--bg-panel)] px-6 py-16 text-center">
        <p className="text-[0.9375rem] text-[var(--text-primary)]">{t('listError')}</p>
        <button type="button" onClick={() => void mutate()} className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--gold-dim)] bg-[#2a1f0c] px-4 text-[0.875rem] font-semibold text-[var(--gold-light)] hover:bg-[#35270e]">
          <RotateCw className="h-4 w-4" aria-hidden="true" />{t('retry')}
        </button>
      </div>
    )
  }
  if (!sinners || !picked || !state) return <SkillMotionSkeleton />

  const shown = pending?.identity ?? picked.identity
  const picker = <MotionPicker sinners={sinners} sinnerId={tab ?? pending?.sinnerId ?? picked.sinnerId} selectedKey={pending ? pending.identity.slug : picked.skill.key} onSinner={setTab} onPick={choose} />

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
            {shown.portrait && <QuietImage src={shown.portrait} alt="" fill sizes="2.75rem" className="object-cover object-[50%_12%]" />}
          </span>
          <span className="line-clamp-2 min-w-0 flex-1 text-[0.9375rem] leading-snug text-[var(--text-primary)]">{shown.label}</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-[var(--gold-light)]" aria-hidden="true" />
        </button>

        {pending ? (
          <>
            <MotionPendingStage />
            <h2 className="break-keep font-[family-name:var(--font-heading)] text-[1.125rem] leading-snug text-[var(--text-primary)] md:text-[1.25rem]">{pending.identity.label}</h2>
          </>
        ) : (
          <>
            <MotionStage
              hostRef={motion.hostRef} status={motion.status} error={motion.error} playing={motion.playing} muted={motion.muted} volume={motion.volume}
              hasAudio={motion.hasAudio} frames={motion.frames} frameStore={motion.frameStore}
              onTogglePlay={motion.togglePlay} onStep={motion.step} onSeek={motion.seek} onToggleMute={motion.toggleMute} onVolume={motion.setVolume}
              onRetry={() => void load(state)} notice={notice} onDismiss={dismissNotice} />

            <div className="flex flex-col gap-4">
              <MotionSkillStrip sinnerId={picked.sinnerId} skills={picked.identity.skills} selectedKey={picked.skill.key} onPick={skill => choose(picked.sinnerId, picked.identity, skill)} />
              <h2 className="-mt-1 break-keep font-[family-name:var(--font-heading)] text-[1.125rem] leading-snug text-[var(--text-primary)] md:text-[1.25rem]">{picked.skill.title}</h2>
              {picked.skill.states.length > 1 && (
                <MotionConditions key={picked.skill.key} states={picked.skill.states} current={state.state}
                  onPick={next => void setQuery({ skill: toParam(picked.skill.key), state: next })} />
              )}
            </div>
          </>
        )}
      </div>

      <aside className="min-w-0 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
        {!pending && <MotionSidePanel skillId={picked.skill.skillId} layers={motion.layers} onLayer={motion.setLayer} />}
      </aside>
      </div>

      <BaseModal open={sheet} onClose={() => setSheet(false)} title={t('title')} sheet maxWidth="32rem" className="max-h-[85dvh] overflow-y-auto">
        {picker}
      </BaseModal>
    </div>
  )
}

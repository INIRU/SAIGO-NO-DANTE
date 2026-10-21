'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Search, X } from 'lucide-react'
import QuietImage from '@/components/ui/QuietImage'
import { getSinnerLogoUrl, getSkillIconUrl } from '@/lib/utils/images'
import type { MotionIdentity, MotionSinner, MotionSkill } from '@/lib/motion/catalog'

/** A game skill sprite from its skill id (the sprite's owner is read from the id; no identity row needed). */
const skillIcon = (sinnerId: string, skillId: number) => getSkillIconUrl({ sinner_id: sinnerId, game_id: '0' }, 0, { image_id: String(skillId) })

function SkillRow({ sinnerId, skill, selected, onPick }: { sinnerId: string; skill: MotionSkill; selected: boolean; onPick: () => void }) {
  const t = useTranslations('motionPage')
  return (
    <li>
      <button type="button" onClick={onPick} aria-current={selected ? 'true' : undefined}
        className="flex w-full items-center gap-2.5 rounded-md py-1.5 pl-2 pr-2.5 text-left transition-colors hover:bg-[rgba(200,144,10,0.08)] aria-[current=true]:bg-[var(--bg-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-[#0a0806]">
          <QuietImage src={skillIcon(sinnerId, skill.skillId)} alt="" fill sizes="2rem" className="object-cover" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[0.875rem] ${selected ? 'text-[var(--gold-light)]' : 'text-[var(--text-primary)]'}`}>{skill.title}</span>
          {skill.states.length > 1 && <span className="block text-[0.75rem] text-[var(--text-secondary)]">{t('stateCount', { count: skill.states.length })}</span>}
        </span>
      </button>
    </li>
  )
}

function IdentityRow({ sinnerId, identity, open, selectedKey, onOpen, onPick }: {
  sinnerId: string; identity: MotionIdentity; open: boolean; selectedKey: string | null; onOpen: () => void; onPick: (skill: MotionSkill) => void
}) {
  return (
    <li className={open ? 'rounded-lg bg-[rgba(255,255,255,0.025)]' : undefined}>
      <button type="button" onClick={onOpen} aria-expanded={open}
        className="group flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-[rgba(200,144,10,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
        <span className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-md border ${open ? 'border-[var(--gold)]' : 'border-[#2e2417]'} bg-[#0a0806]`}>
          {identity.portrait && <QuietImage src={identity.portrait} alt="" fill sizes="2.75rem" className="object-cover object-[50%_12%]" />}
        </span>
        <span className={`line-clamp-2 min-w-0 flex-1 text-[0.875rem] leading-snug ${open ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>{identity.label}</span>
      </button>
      {open && (
        <ul className="pb-1.5 pl-[3.5rem] pr-1">
          {identity.skills.flatMap((skill, k) => [
            // Another form of the identity: a line between its own skills and the form's.
            ...(k > 0 && skill.form !== identity.skills[k - 1].form ? [<li key={`${skill.key}:form`} aria-hidden="true" className="mx-2 my-1.5 h-px bg-[#3a2a15]" />] : []),
            <SkillRow key={skill.key} sinnerId={sinnerId} skill={skill} selected={skill.key === selectedKey} onPick={() => onPick(skill)} />,
          ])}
        </ul>
      )}
    </li>
  )
}

/**
 * The motion list: the twelve sinners on top, the chosen sinner's identities (the open one shows its skills), and a search
 * over identity and skill names that lists matches across every sinner.
 */
export default function MotionPicker({ sinners, sinnerId, selectedKey, onSinner, onPick }: {
  sinners: MotionSinner[]
  sinnerId: string
  selectedKey: string | null
  onSinner: (id: string) => void
  onPick: (sinnerId: string, identity: MotionIdentity, skill: MotionSkill) => void
}) {
  const t = useTranslations('motionPage')
  const tSinner = useTranslations('sinner')
  const [query, setQuery] = useState('')
  const needle = useDeferredValue(query.trim().toLowerCase())
  // A form's skill keeps its own slug in the key, so the open identity is found by the skill.
  const [openSlug, setOpenSlug] = useState<string | null>(() => sinners.flatMap(s => s.identities).find(identity => identity.skills.some(skill => skill.key === selectedKey))?.slug ?? null)
  const sinner = sinners.find(s => s.id === sinnerId) ?? sinners[0]

  const matches = useMemo(() => {
    if (!needle) return null
    return sinners.flatMap(s => s.identities.flatMap(identity => {
      const hitIdentity = identity.label.toLowerCase().includes(needle)
      const skills = hitIdentity ? identity.skills : identity.skills.filter(skill => skill.title.toLowerCase().includes(needle))
      return skills.length ? [{ sinnerId: s.id, identity: { ...identity, skills } }] : []
    }))
  }, [needle, sinners])

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden="true" />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('search')} aria-label={t('search')}
          className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel)] pl-9 pr-9 text-[0.875rem] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--gold)] focus:outline-none" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label={t('search')} className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </label>

      {!matches && (
        <div role="tablist" aria-label={t('sinners')} className="grid grid-cols-6 gap-1.5">
          {sinners.map(s => {
            const active = s.id === sinner?.id
            return (
              <button key={s.id} type="button" role="tab" aria-selected={active} title={tSinner(s.id)} aria-label={tSinner(s.id)} onClick={() => onSinner(s.id)}
                className={`relative grid aspect-square place-items-center rounded-md border transition-colors ${active ? 'border-[var(--gold)] bg-[var(--bg-elevated)]' : 'border-[#2e2417] bg-[var(--bg-panel)] hover:border-[#5a4526]'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]`}>
                <Image src={getSinnerLogoUrl(s.id)} alt="" width={40} height={40} className={`h-[70%] w-[70%] object-contain transition-opacity ${active ? 'opacity-100' : 'opacity-55'}`} />
              </button>
            )
          })}
        </div>
      )}

      <ul className="flex flex-col gap-0.5" aria-label={matches ? t('search') : sinner ? tSinner(sinner.id) : undefined}>
        {matches
          ? matches.length === 0
            ? <li className="px-2 py-6 text-center text-[0.875rem] text-[var(--text-secondary)]">{t('noResults')}</li>
            : matches.map(({ sinnerId: id, identity }) => (
                <IdentityRow key={identity.slug} sinnerId={id} identity={identity} open selectedKey={selectedKey}
                  onOpen={() => {}} onPick={skill => onPick(id, identity, skill)} />
              ))
          : sinner?.identities.map(identity => (
              <IdentityRow key={identity.slug} sinnerId={sinner.id} identity={identity} open={openSlug === identity.slug} selectedKey={selectedKey}
                onOpen={() => setOpenSlug(openSlug === identity.slug ? null : identity.slug)}
                onPick={skill => onPick(sinner.id, identity, skill)} />
            ))}
      </ul>
    </div>
  )
}

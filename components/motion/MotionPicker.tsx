'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Hourglass, Search, X } from 'lucide-react'
import QuietImage from '@/components/ui/QuietImage'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import type { MotionIdentity, MotionSinner, MotionSkill } from '@/lib/motion/catalog'
import { motionSkillIcon } from './MotionSkillStrip'

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]'

function IdentityRow({ identity, selected, onPick, children }: { identity: MotionIdentity; selected: boolean; onPick: () => void; children?: ReactNode }) {
  const t = useTranslations('motionPage')
  return (
    <li>
      <button type="button" onClick={onPick} aria-current={selected ? 'true' : undefined}
        className={`group flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-[rgba(200,144,10,0.08)] aria-[current=true]:bg-[rgba(200,144,10,0.12)] ${focusRing}`}>
        <span className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-[#0a0806] transition-colors ${selected ? 'border-[var(--gold)]' : 'border-[#2e2417]'}`}>
          {identity.portrait && <QuietImage src={identity.portrait} alt="" fill sizes="2.75rem" loading="eager" className="object-cover object-[50%_12%]" />}
        </span>
        <span className={`line-clamp-2 min-w-0 flex-1 text-[0.875rem] leading-snug transition-colors ${selected ? 'text-[var(--gold-light)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>{identity.label}</span>
        {identity.pending && <Hourglass className="mr-1 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" role="img" aria-label={t('pendingTitle')} />}
      </button>
      {children}
    </li>
  )
}

/**
 * The motion list: the twelve sinners on top and the chosen sinner's identities (a skill is picked under the stage), or
 * a search over identity and skill names across every sinner, where a skill that matched is listed under its identity.
 */
export default function MotionPicker({ sinners, sinnerId, selectedKey, onSinner, onPick }: {
  sinners: MotionSinner[]
  sinnerId: string
  selectedKey: string | null
  onSinner: (id: string) => void
  onPick: (sinnerId: string, identity: MotionIdentity, skill?: MotionSkill) => void
}) {
  const t = useTranslations('motionPage')
  const tSinner = useTranslations('sinner')
  const [query, setQuery] = useState('')
  const needle = useDeferredValue(query.trim().toLowerCase())
  const sinner = sinners.find(s => s.id === sinnerId) ?? sinners[0]
  // A sinner's list, once shown, stays (hidden) while another is: going back shows it at once, its portraits already drawn.
  const [seen, setSeen] = useState<readonly string[]>(() => (sinner ? [sinner.id] : []))
  if (sinner && !seen.includes(sinner.id)) setSeen([...seen, sinner.id])
  // A pending identity is chosen by its slug, the others by one of their skills.
  const owns = (identity: MotionIdentity) => identity.slug === selectedKey || identity.skills.some(skill => skill.key === selectedKey)

  // The chosen identity in view when the list opens (a shared link, the sheet on a phone).
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => { list.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' }) }, [])

  const matches = useMemo(() => {
    if (!needle) return null
    return sinners.flatMap(s => s.identities.flatMap(identity => {
      if (identity.label.toLowerCase().includes(needle)) return [{ sinnerId: s.id, identity, skills: [] as MotionSkill[] }]
      const skills = identity.skills.filter(skill => skill.title.toLowerCase().includes(needle))
      return skills.length ? [{ sinnerId: s.id, identity, skills }] : []
    }))
  }, [needle, sinners])

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden="true" />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('search')} aria-label={t('search')}
          className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel)] pl-9 pr-9 text-[0.875rem] text-[var(--text-primary)] transition-colors placeholder:text-[var(--text-secondary)] focus:border-[var(--gold)] focus:outline-none" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label={t('search')} className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </label>

      {!matches && (
        <div role="tablist" aria-label={t('sinners')} className="grid grid-cols-6 gap-1">
          {sinners.map(s => {
            const active = s.id === sinner?.id
            return (
              <button key={s.id} type="button" role="tab" aria-selected={active} title={tSinner(s.id)} aria-label={tSinner(s.id)} onClick={() => onSinner(s.id)}
                className={`group relative grid aspect-square place-items-center rounded-md border transition-[background-color,border-color,transform] active:scale-95 ${active ? 'border-[var(--border)] bg-[rgba(200,144,10,0.12)]' : 'border-transparent hover:bg-[rgba(232,220,200,0.05)]'} ${focusRing}`}>
                <Image src={getSinnerLogoUrl(s.id)} alt="" width={40} height={40} className={`h-[70%] w-[70%] object-contain transition-opacity ${active ? 'opacity-100' : 'opacity-55 group-hover:opacity-95'}`} />
              </button>
            )
          })}
        </div>
      )}

      <div ref={list}>
      {matches ? (
      <ul className="flex flex-col gap-0.5" aria-label={t('search')}>
        {matches.length === 0
            ? <li className="px-2 py-6 text-center text-[0.875rem] text-[var(--text-secondary)]">{t('noResults')}</li>
            : matches.map(({ sinnerId: id, identity, skills }) => (
                <IdentityRow key={identity.slug} identity={identity} selected={owns(identity)} onPick={() => onPick(id, identity, skills[0])}>
                  {skills.length > 0 && (
                    <ul className="pb-1 pl-[3.5rem] pr-1">
                      {skills.map(skill => (
                        <li key={skill.key}>
                          <button type="button" onClick={() => onPick(id, identity, skill)} aria-current={skill.key === selectedKey ? 'true' : undefined}
                            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[0.8125rem] text-[var(--text-secondary)] transition-colors hover:bg-[rgba(200,144,10,0.08)] hover:text-[var(--text-primary)] aria-[current=true]:text-[var(--gold-light)] ${focusRing}`}>
                            <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded bg-[#0a0806]">
                              <QuietImage src={motionSkillIcon(id, skill.skillId)} alt="" fill sizes="1.75rem" className="object-cover" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{skill.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </IdentityRow>
              ))}
      </ul>
      ) : sinners.filter(s => seen.includes(s.id)).map(s => (
        <ul key={s.id} hidden={s.id !== sinner?.id} className="flex flex-col gap-0.5" aria-label={tSinner(s.id)}>
          {s.identities.map(identity => (
            <IdentityRow key={identity.slug} identity={identity} selected={owns(identity)} onPick={() => onPick(s.id, identity)} />
          ))}
        </ul>
      ))}
      </div>
    </div>
  )
}

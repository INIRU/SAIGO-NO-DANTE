'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { ArrowUpRight, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import BaseModal from '@/components/ui/BaseModal'
import IdentityFrameCard from '@/features/catalog/components/IdentityFrameCard'
import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import IdentityCombatSection from '@/features/catalog/components/IdentityCombatSection'
import { useIdentitySkillModel } from '@/features/catalog/hooks/useIdentitySkillModel'
import EgoDisplayCard from '@/features/catalog/components/EgoDisplayCard'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { localizeDeckKeyword } from '@/features/decks'
import { identityNameLines } from '../lib/identity-name-lines'
import { localizeEgoName, type EgoEntry } from '@/features/decks/components/DeckIdentityCard'
import { Link } from '@/lib/i18n/navigation'
import { getIdentitySinColor } from '@/lib/data/sinners'
import { normalizeThemeKeyword, THEME_KEYWORDS } from '@/lib/constants/keywords'
import { identityAtLevel, skillsAtLevel, MAX_IDENTITY_LEVEL } from '@/features/catalog/lib/identity-level'
import { useOwnKeywords } from '@/hooks/useOwnKeywords'
import { descriptionTexts } from '@/lib/keywords/own-keywords'
import { getLocalizedName } from '@/lib/i18n/localize'
import { getDetailStatIconUrl } from '@/lib/utils/images'
import type { SupportedLang } from '@/lib/i18n/types'
import type { Identity, Passive, Skill } from '@/lib/types'
import { MultipliedCount } from '@/features/catalog/components/PassiveParts'

type IdentityResponse = { identity: Identity; skills: Skill[]; passives: Passive[] }

// Reopening the same identity (or another card in the same deck twice) is instant.
const responses = new Map<string, Promise<IdentityResponse>>()
function loadIdentity(id: string) {
  let request = responses.get(id)
  if (!request) {
    request = fetch(`/api/identity/${id}`).then(res => {
      if (!res.ok) throw new Error(String(res.status))
      return res.json() as Promise<IdentityResponse>
    })
    request.catch(() => responses.delete(id))
    responses.set(id, request)
  }
  return request
}

const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)
const RES_ICONS = { slash: getDetailStatIconUrl('slash'), pierce: getDetailStatIconUrl('pierce'), blunt: getDetailStatIconUrl('blunt') }

interface IdentityDetailModalProps {
  identityId: string
  /** Deck uptie 1–4; the card art, skills and passives open at it. Missing = highest level with data. */
  uptie?: number | null
  /** The deck's E.G.O for this sinner; the section shows only when passed. */
  egos?: EgoEntry[]
  onEgoClick?: (egoId: string) => void
  onClose: () => void
}

export default function IdentityDetailModal({ identityId, uptie, egos, onEgoClick, onClose }: IdentityDetailModalProps) {
  const t = useTranslations('decks.identityPreview')
  const locale = useLocale() as SupportedLang
  const [state, setState] = useState<{ id: string; data?: IdentityResponse; error?: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadIdentity(identityId)
      .then(data => { if (!cancelled) setState({ id: identityId, data }) })
      .catch(() => { if (!cancelled) setState({ id: identityId, error: true }) })
    return () => { cancelled = true }
  }, [identityId, attempt])

  const current = state?.id === identityId ? state : null
  const data = current?.data
  const title = data ? getLocalizedName(data.identity, locale) : t('title')

  return (
    <BaseModal open onClose={onClose} maxWidth="56rem" sheet title={title}>
      <div className="flex h-[92dvh] flex-col overflow-hidden border sm:h-[min(88dvh,58rem)]" style={{ background: 'var(--bg-deep)' }}>
        {data ? (
          <LoadedContent key={identityId} data={data} uptie={uptie} egos={egos} onEgoClick={onEgoClick} onClose={onClose} />
        ) : current?.error ? (
          <>
            <Header onClose={onClose} closeLabel={t('close')} art={null}>{null}</Header>
            <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('loadError')}</p>
              <button type="button" onClick={() => { setState(null); setAttempt(n => n + 1) }}
                className="min-h-[2.75rem] rounded border border-[var(--border)] px-4 text-sm transition-colors hover:border-[var(--gold)] hover:text-[var(--gold-light)]">
                {t('retry')}
              </button>
            </div>
          </>
        ) : (
          <LoadingContent onClose={onClose} closeLabel={t('close')} />
        )}
      </div>
    </BaseModal>
  )
}

/** Fixed top of the panel: card art, identity info and the close button. The body below is the only scroll area. */
function Header({ art, children, onClose, closeLabel }: { art: ReactNode; children: ReactNode; onClose: () => void; closeLabel: string }) {
  return (
    <header className="flex shrink-0 items-start gap-3 border-b border-[#2e2417] bg-[#17120c] py-3 pl-3 pr-1.5 sm:gap-5 sm:py-4 sm:pl-5 sm:pr-3">
      <div className="w-[5.25rem] shrink-0 sm:w-[7.5rem]">{art}</div>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
      <button type="button" onClick={onClose} aria-label={closeLabel}
        className="-mt-0.5 shrink-0 rounded text-[var(--text-secondary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]">
        <X size={20} aria-hidden="true" />
      </button>
    </header>
  )
}

function LoadedContent({ data, uptie, egos, onEgoClick, onClose }: Omit<IdentityDetailModalProps, 'identityId'> & { data: IdentityResponse }) {
  const t = useTranslations('decks.identityPreview')
  const rootT = useTranslations()
  const locale = useLocale() as SupportedLang
  const keywordInfo = useKeywords()
  const { sinMap, getIconUrl } = useKeywordData()

  // Same numbers as the identity page, which opens at the max level.
  const identity = useMemo(() => identityAtLevel(data.identity, MAX_IDENTITY_LEVEL), [data.identity])
  const skills = useMemo(() => skillsAtLevel(data.skills, MAX_IDENTITY_LEVEL), [data.skills])
  const model = useIdentitySkillModel(skills, data.passives, uptie)
  const ownTexts = useMemo(() => descriptionTexts(data.skills, data.passives), [data.skills, data.passives])
  const allowedKeywords = useOwnKeywords(identity.keywords, ownTexts)
  const sinColor = getIdentitySinColor(identity, sinMap)

  const nameLines = identityNameLines(getLocalizedName(identity, locale), identity.game_id, locale)
  const themeKeywords = [...new Set((identity.keywords ?? []).map(normalizeThemeKeyword).filter(kw => THEME_KW_SET.has(kw)))]
  const resistances = [
    { key: 'slash', label: rootT('identity.info.slash'), value: identity.slash_res },
    { key: 'pierce', label: rootT('identity.info.pierce'), value: identity.pierce_res },
    { key: 'blunt', label: rootT('identity.info.blunt'), value: identity.blunt_res },
  ] as const

  return (
    <>
      <Header onClose={onClose} closeLabel={t('close')} art={
        <IdentityFrameCard identity={identity} uptie={model.uptieLevel} name={getLocalizedName(identity, locale)} sizes="7.5rem" />
      }>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.8125rem]">
          <span style={{ color: 'var(--text-secondary)' }}>{rootT(`sinner.${identity.sinner_id}`)}</span>
          <Link href={`/sinners/${identity.sinner_id}/identities/${identity.id}`}
            className="-my-2.5 inline-flex items-center gap-0.5 py-2.5 text-[var(--text-muted)] transition-colors hover:text-[var(--gold-light)]">
            {t('openPage')}<ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        </div>
        <h2 className="mt-1 break-keep text-[1.0625rem] leading-snug sm:text-[1.375rem]" style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
          {nameLines.map((line, i) => <span key={i} className="block">{line}</span>)}
        </h2>

        <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:mt-3 sm:gap-x-5">
          {[
            { icon: 'health' as const, label: rootT('identity.stats.hp'), value: identity.hp },
            { icon: 'speed' as const, label: rootT('identity.stats.speed'), value: `${identity.speed_min}–${identity.speed_max}` },
            { icon: 'defense' as const, label: rootT('identity.stats.defLevel'), value: identity.def_level },
          ].map(stat => (
            <div key={stat.icon} className="flex items-center gap-1.5" title={stat.label}>
              <dt><Image src={getDetailStatIconUrl(stat.icon)} alt={stat.label} width={20} height={20} className="h-4 w-4 sm:h-5 sm:w-5" /></dt>
              <dd className="text-[1.125rem] leading-none tabular-nums sm:text-[1.375rem]" style={{ fontFamily: 'var(--font-excelsior)', color: 'var(--text-primary)' }}>{stat.value}</dd>
            </div>
          ))}
          {/* Mobile: resistances start a new row. Desktop: a divider between stats and resistances. */}
          <div className="h-0 basis-full sm:h-5 sm:w-px sm:basis-auto sm:bg-[#2e2417]" aria-hidden="true" />
          {resistances.map(res => {
            const weak = res.value === '취약'
            const resist = res.value === '내성'
            const label = rootT(weak ? 'identity.resistance.weak' : resist ? 'identity.resistance.resistant' : 'identity.resistance.normal')
            return (
              <div key={res.key} className="flex items-center gap-1" title={`${res.label} ${label}`}>
                <dt><Image src={RES_ICONS[res.key]} alt={res.label} width={18} height={18} className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" /></dt>
                <dd className="flex items-center gap-1">
                  <MultipliedCount value={resist ? '0.5' : weak ? '2' : '1'} className="text-[1.0625rem] sm:text-[1.25rem]" style={{ fontFamily: 'var(--font-excelsior)', color: weak ? '#e69b86' : resist ? '#91beb4' : 'var(--text-primary)' }} />
                  <span className="hidden text-[0.75rem] text-[var(--text-secondary)] sm:inline">{label}</span>
                </dd>
              </div>
            )
          })}
        </dl>

        {themeKeywords.length > 0 && (
          <ul className="mt-2 hidden flex-wrap gap-1.5 sm:flex">
            {themeKeywords.map(kw => {
              const icon = getIconUrl(kw)
              return (
                <li key={kw} className="inline-flex min-h-[1.75rem] items-center gap-1 rounded border border-[#2e2417] bg-[var(--bg-panel)] px-2 text-[0.8125rem] text-[var(--text-secondary)]">
                  {icon && <Image src={icon} alt="" width={16} height={16} />}
                  {localizeDeckKeyword(kw, keywordInfo[kw], locale)}
                </li>
              )
            })}
          </ul>
        )}
      </Header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-3 sm:px-6 sm:pt-4">
        <IdentityCombatSection level={MAX_IDENTITY_LEVEL} identity={identity} sinColor={sinColor} allowedKeywords={allowedKeywords} model={model} compact />

        {egos && (
          <section className="mt-8" aria-labelledby="identity-modal-ego">
            <h3 id="identity-modal-ego" className="mb-4 border-b border-[#2e2417] pb-2 text-[1.0625rem] text-[var(--gold)]">{t('ego')}</h3>
            {egos.length > 0 ? (
              <div className="grid grid-cols-2 justify-items-center gap-x-2 gap-y-6 sm:grid-cols-4 sm:gap-x-3">
                {egos.map(({ grade, ego }) => (
                  <EgoDisplayCard
                    key={ego.id}
                    ego={{ grade: ego.grade ?? grade, image_url: ego.image_url, sin_affinity: ego.sin_affinity }}
                    lang={locale}
                    name={localizeEgoName(ego, locale)}
                    onClick={onEgoClick ? () => onEgoClick(ego.id) : undefined}
                    sinnerId={ego.sinner_id || identity.sinner_id}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">{t('noEgo')}</p>
            )}
          </section>
        )}
      </div>
    </>
  )
}

/** Same header and body boxes as the loaded modal, so nothing shifts when data arrives. */
function LoadingContent({ onClose, closeLabel }: { onClose: () => void; closeLabel: string }) {
  return (
    <>
      <Header onClose={onClose} closeLabel={closeLabel} art={<Skeleton raised className="w-full" style={{ aspectRatio: '290 / 428' }} />}>
        <SkeletonLine raised w="6rem" h="0.8125rem" />
        <SkeletonLine raised w="min(18rem, 90%)" h="1.375rem" className="mt-2" />
        <SkeletonLine raised w="min(26rem, 100%)" h="1.25rem" className="mt-3" />
        <div className="mt-2 hidden gap-1.5 sm:flex">{[0, 1, 2].map(i => <Skeleton raised key={i} className="h-7 w-16" />)}</div>
      </Header>
      <SkeletonPage className="min-h-0 flex-1 overflow-hidden px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="mb-4 flex items-end gap-7 border-b border-[#2e2417] pb-2.5"><SkeletonLine w="3.5rem" h="1.0625rem" /><SkeletonLine w="4rem" h="1.0625rem" /><Skeleton className="ml-auto h-10 w-44" /></div>
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3 rounded border border-[#2e2417] bg-[#17120c] px-4 py-4 sm:px-6">
              <Skeleton raised className="h-[6.5rem] w-[6.5rem] shrink-0 sm:h-32 sm:w-32" />
              <div className="min-w-0 flex-1 space-y-2"><SkeletonLine raised w="40%" h="0.75rem" /><SkeletonLine raised w="70%" h="1.25rem" /><SkeletonLine raised w="30%" h="1rem" /></div>
            </div>
          ))}
        </div>
      </SkeletonPage>
    </>
  )
}

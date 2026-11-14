'use client'

import BackLink from '@/components/navigation/BackLink'
import { pendingNoteUploads, noteUploadInProgressMessage } from '@/lib/notes/images'

import { showError, showSuccess } from '@/lib/toast'
import { guestHeaders, getGuestCopy, guestPinProblem } from '@/features/account'
import GuestPinInput from '@/features/account/components/GuestPinInput'
import { deleteTempSlot, saveTempSlot, type TempSlot } from '@/lib/drafts/temp-slots'
import { DECK_DRAFTS_KEY, autosaveKey, isDeckDraft, loadDeckDraftSlots, type DeckDraft } from '@/features/notes'
import TempSaveMenu from '@/components/ui/TempSaveMenu'
import AutosaveRestoreModal from '@/components/ui/AutosaveRestoreModal'
import { useAutosaveDraft } from '@/features/notes/hooks/useAutosaveDraft'
import SeriesPicker from '@/features/community/components/SeriesPicker'

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useRouter } from '@/lib/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useQueryState, parseAsString } from 'nuqs'
import { Link } from '@/lib/i18n/navigation'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  Passive,
} from '@/lib/data/sinners'
// IdentityCard → IdentityTab 내부에서 직접 렌더링

import { encodeDeckCode, decodeDeckCode } from '@/lib/decks/deck-code-utils'
import { contentTypeMessageKey } from '@/features/decks'
import { buildDeckInsightData, buildDeckSaveRows, useDeckBuilderModel, useDeckBuilderState, type EditMode, type ForkMode } from '@/features/decks/hooks/useDeckBuilder'
import UnderlineTabBar, { type TabItem } from '@/components/ui/UnderlineTabBar'
import Dropdown from '@/components/ui/Dropdown'
import Button from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FormationSourceModal from '@/features/planner/components/FormationSourceModal'
import { deckFormationFromPlan } from '@/lib/planner/formation-transfer'
import type { EgoSlot, IdentitySlot } from '@/lib/planner/types'
import { CONTENT_TYPES } from '@/lib/constants/deck-tokens'
import { Users, Sparkles, SlidersHorizontal, FileText, ArrowLeft, Copy, Download, Upload, Check } from 'lucide-react'
import { IdentityTab, EgoTab, SkillsetTab } from '@/features/decks/components/DeckBuilderTabs'
import DeckInsights from '@/features/decks/components/DeckInsights'
import DeckResourceSummary from '@/features/decks/components/DeckResourceSummary'
import type { SupportedLang } from '@/lib/i18n/types'
import type { EgoGiftNote } from '@/lib/types'
import { MAX_DECK_MAIN_KEYWORDS } from '@/lib/decks/keyword-rules'


// CONTENT_TYPES, ContentType, CONTENT_TYPE_COLORS → deck-tokens.ts에서 import


interface Props {
  sinners: Sinner[]
  identities: Identity[]
  egos: EGO[]
  skills: Skill[]
  passives: Passive[]
  egoGifts?: EgoGiftNote[]
  editMode?: EditMode
  forkMode?: ForkMode
}

type Tab = 'identity' | 'ego' | 'skillset' | 'note'

const DeckNoteEditor = dynamic(() => import('@/features/decks/components/DeckNoteEditor'), {
  ssr: false,
  loading: () => null,
})

export default function DeckBuilderClient({ sinners, identities, egos, skills, passives, egoGifts = [], editMode, forkMode }: Props) {
  const locale = useLocale()
  const sinnerT = useTranslations('sinner')
  const deckT = useTranslations('decks')
  const builderT = useTranslations('decks.builder')
  const tTempSaves = useTranslations('planner.tempSaves')
  const tCopy = useTranslations('planner.detail')
  const router = useRouter()
  // The editor state first (it cleans ?formation= from the address), then the tab, the saved drafts, and last what is derived from the state.
  const builderState = useDeckBuilderState({ sinners, identities, egos, editMode, forkMode })
  const {
    deckSlots, setDeckSlots, egoSlots, setEgoSlots, formationOrder, setFormationOrder, title, setTitle, contentType, setContentType,
    description, setDescription, gacksungSlots, upties, setUpties, skillDistribution, setSkillDistribution,
  } = builderState
  const [tabParam, setTab] = useQueryState('tab', parseAsString.withDefault('identity'))
  const tab = (tabParam as Tab) || 'identity'
  const [saving, setSaving] = useState(false)
  const [pin, setPin] = useState('')
  // undefined: the author did not touch the series picker, so the deck's series stays as it is
  const [seriesChoice, setSeriesChoice] = useState<string | null | undefined>(undefined)
  // toast는 Sonner가 글로벌로 처리 (showError from lib/toast)
  const [descPreview, setDescPreview] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeApplying, setCodeApplying] = useState(false)
  const [codeError, setCodeError] = useState(false)
  const { status: authStatus } = useSession()
  const [draftSlots, setDraftSlots] = useState<TempSlot<DeckDraft>[]>([])
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    setDraftSlots(loadDeckDraftSlots())
  }, [])

  const {
    skillsByIdentityId, passivesByIdentityId, deckKeywordCounts, effectiveMainKeywords, formationGiftKeywordCounts, allGiftKeywordCounts,
    handleMainKeywordToggle, handleFormationToggle, identityCount, egoCount, skillsetCustomCount, draftState,
    applyDraft, applyImportedFormation, applyDecodedDeck,
  } = useDeckBuilderModel({ sinners, identities, egos, skills, passives, state: builderState })

  // Planner deck panels: keyword distribution, passives, attack types and sin resources.
  const deckInsights = useMemo(() => {
    const { resources, ...insights } = buildDeckInsightData({
      sinners, deckSlots, egoSlots, formationOrder, skillDistribution, skillsByIdentityId, passivesByIdentityId, locale,
      localizeSinnerName: sinnerId => sinnerT(sinnerId as Parameters<typeof sinnerT>[0]),
    })
    return { ...insights, summary: <DeckResourceSummary resources={resources} /> }
  }, [deckSlots, egoSlots, formationOrder, locale, passivesByIdentityId, sinners, sinnerT, skillDistribution, skillsByIdentityId])

  // A new guest deck takes a password, asked for when the browser's key is gone.
  const needsPin = authStatus === 'unauthenticated' && !editMode

  const handleSave = async () => {
    if (pendingNoteUploads.size) { showError(noteUploadInProgressMessage(locale)); return }
    if (!title.trim() || identityCount < 12 || !contentType) return
    const pinProblem = needsPin ? guestPinProblem(pin, locale) : null
    if (pinProblem) { showError(pinProblem); return }
    setSaving(true)
    const { identitySlots, egoRows } = buildDeckSaveRows({ sinners, deckSlots, gacksungSlots, upties, formationOrder, skillDistribution, egoSlots })
    const url = editMode ? `/api/decks/${editMode.deckId}` : '/api/decks'
    const method = editMode ? 'PATCH' : 'POST'
    const signedIn = authStatus === 'authenticated'
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...guestHeaders(signedIn) },
        body: JSON.stringify({ title, description, tags: editMode?.tags ?? [], main_keywords: effectiveMainKeywords, content_type: contentType, identitySlots, egoSlots: egoRows, ...(needsPin ? { pin } : {}), ...(seriesChoice !== undefined ? { series_id: seriesChoice } : {}) }),
      })
      if (res.ok) {
        if (!signedIn) showSuccess(editMode ? getGuestCopy(locale).updated : getGuestCopy(locale).posted)
        autosave.clear()
        router.push(editMode ? `/decks/${editMode.deckId}` : '/decks', { locale: locale as SupportedLang })
      } else {
        const data = await res.json().catch(() => null)
        const fallback = editMode ? builderT('errors.updateFailed') : builderT('errors.saveFailed')
        // A server fault says nothing a visitor can act on; the translated line does.
        showError(res.status >= 500 ? fallback : data?.error ?? fallback)
      }
    } catch {
      showError(editMode ? builderT('errors.updateFailed') : builderT('errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDraft = (slot: TempSlot<DeckDraft>) => {
    if (pendingNoteUploads.size) { showError(noteUploadInProgressMessage(locale)); return }
    const draft: DeckDraft = { ...draftState, savedAt: Date.now() }
    const slots = saveTempSlot(DECK_DRAFTS_KEY, slot.slotNumber, draft, title.trim() || tTempSaves('untitledDeck'), isDeckDraft)
    if (!slots) { showError(tTempSaves('saveFailed')); return }
    setDraftSlots(slots)
    showSuccess(tTempSaves(slot.draft ? 'overwritten' : 'savedToSlot', { slot: slot.slotNumber }))
  }

  const handleLoadDraft = (slot: TempSlot<DeckDraft>) => {
    if (slot.draft && applyDraft(slot.draft.state)) showSuccess(tTempSaves('loadedFromSlot', { slot: slot.slotNumber }))
  }
  const autosave = useAutosaveDraft({
    storageKey: autosaveKey('deck', editMode?.deckId), state: draftState, isState: isDeckDraft, ready: true, apply: applyDraft,
    savedAt: editMode?.updatedAt ? Date.parse(editMode.updatedAt) : null,
  })
  const handleDeleteDraft = (slot: TempSlot<DeckDraft>) => {
    setDraftSlots(deleteTempSlot(DECK_DRAFTS_KEY, slot.slotNumber, isDeckDraft))
    showSuccess(tTempSaves('deletedFromSlot', { slot: slot.slotNumber }))
  }

  // Import from one of my plans: asks first when a formation is already set.
  const tImport = useTranslations('planner.formationImport')
  const [importOpen, setImportOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ formation: ReturnType<typeof deckFormationFromPlan>; title: string } | null>(null)
  const applyImport = (formation: ReturnType<typeof deckFormationFromPlan>) => {
    applyImportedFormation(formation)
    showSuccess(tImport('applied'))
  }
  const handlePlanLoaded = (record: Record<string, unknown>) => {
    const planSlots = (Array.isArray(record.deck) ? record.deck : []) as IdentitySlot[]
    if (!planSlots.length) { showError(tImport('loadFailed')); return }
    const formation = deckFormationFromPlan(planSlots, (Array.isArray(record.egos) ? record.egos : []) as EgoSlot[])
    setImportOpen(false)
    if (formationOrder.length) setPendingImport({ formation, title: String(record.title ?? '') })
    else applyImport(formation)
  }

  const handleApplyCode = async () => {
    if (!codeInput.trim()) return
    setCodeApplying(true)
    setCodeError(false)
    const result = await decodeDeckCode(codeInput.trim(), sinners, identities, egos)
    setCodeApplying(false)
    if (!result) { setCodeError(true); return }
    applyDecodedDeck(result)
    setCodeInput('')
    setTab('identity')
  }

  const handleCopyCode = async () => {
    const code = await encodeDeckCode(sinners, identities, egos, deckSlots, egoSlots, formationOrder)
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      showError(tCopy('copyDeckCodeFailed'))
      return
    }
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const tabItems: TabItem[] = [
    { key: 'identity', label: builderT('tabs.identity'), badge: identityCount || undefined, icon: Users },
    { key: 'ego',      label: builderT('tabs.ego'), badge: egoCount || undefined, icon: Sparkles },
    { key: 'skillset', label: builderT('tabs.skillset'), badge: skillsetCustomCount || undefined, icon: SlidersHorizontal },
    { key: 'note', label: builderT('tabs.note'), icon: FileText },
    // 편성 순서는 인격 탭의 40%/60% 호버로 통합
  ]

  return (
    <div className="min-h-[100dvh] pt-24 pb-20 sm:pt-28" style={{ background: 'var(--bg-deep)' }}>
      <FormationSourceModal kind="plan" open={importOpen} onClose={() => setImportOpen(false)} onLoaded={handlePlanLoaded} />
      <ConfirmModal open={pendingImport !== null} title={tImport('replaceTitle')} message={pendingImport?.title || tImport('untitled')}
        confirmLabel={tImport('replaceConfirm')} variant="warning"
        onConfirm={() => { if (pendingImport) applyImport(pendingImport.formation); setPendingImport(null) }} onCancel={() => setPendingImport(null)} />
      <AutosaveRestoreModal savedAt={autosave.offer?.savedAt ?? null} onRestore={autosave.restore} onDiscard={autosave.discard} />
      <div className="deck-workspace mx-auto max-w-6xl px-3 sm:px-6">
        <header
          className="mb-6"
          style={{
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="deck-workspace-header py-4">
            <div className="deck-workspace-heading">
              <div className="min-w-0">
                <BackLink href="/decks" locale={locale as SupportedLang} className="mb-0.5 inline-flex min-h-10 items-center gap-1.5 rounded px-1 transition-colors sm:min-h-11" style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                <ArrowLeft style={{ width: '1rem', height: '1rem' }} /> {builderT('backToDecks')}
                </BackLink>
                <h1 className="sr-only">{editMode ? builderT('titleEdit') : builderT('titleNew')}</h1>
                <p className="sr-only">
                  {builderT('description')}
                </p>
              </div>
              <div className="deck-workspace-actions flex flex-wrap items-center gap-2">
                <div className="deck-workspace-code">
                  <input
                    type="text"
                    value={codeInput}
                    onChange={e => { setCodeInput(e.target.value); setCodeError(false) }}
                    placeholder={builderT('fields.codePlaceholder')}
                    aria-label={builderT('fields.deckCode')}
                    aria-invalid={codeError}
                    className="min-h-10 min-w-0 flex-1 rounded px-3 outline-none sm:min-h-11"
                    style={{ background: 'var(--bg-elevated)', border: `1px solid ${codeError ? 'var(--error)' : 'var(--border)'}`, color: 'var(--text-primary)', fontSize: '0.9375rem', fontFamily: 'var(--font-mono)' }}
                    onKeyDown={e => { if (e.key === 'Enter') handleApplyCode() }}
                  />
                  <Button size="sm" variant="outline" onClick={handleApplyCode} disabled={!codeInput.trim() || codeApplying}>
                    {codeApplying ? builderT('fields.applying') : builderT('fields.applyCode')}
                  </Button>
                  {codeError && <span role="alert" className="deck-workspace-code-error">{builderT('fields.codeError')}</span>}
                </div>
                <Button size="sm" icon={Download} onClick={() => setImportOpen(true)} variant="secondary">{tImport('fromPlan')}</Button>
                <SeriesPicker kind="deck" postId={editMode?.deckId} onChange={setSeriesChoice} />
                <TempSaveMenu title={tTempSaves('deckMenuLabel')} slots={draftSlots} onSave={handleSaveDraft} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />
                <Button
                  size="sm"
                  icon={codeCopied ? Check : Copy}
                  onClick={handleCopyCode}
                  disabled={identityCount < 12}
                  variant="secondary"
                  title={identityCount < 12 ? builderT('actions.copyDisabled') : undefined}
                >
                  {codeCopied ? builderT('actions.copied') : builderT('actions.copyCode')}
                </Button>
                <Button
                  size="sm"
                  icon={Upload}
                  onClick={handleSave}
                  disabled={authStatus === 'loading' || !title.trim() || identityCount < 12 || !contentType || saving}
                  variant="primary"
                  title={!contentType ? builderT('actions.contentRequired') : identityCount < 12 ? builderT('actions.identityRequired', { count: identityCount, total: sinners.length }) : undefined}
                >
                  {saving ? builderT('actions.saving') : editMode ? builderT('actions.save') : builderT('actions.upload')}
                </Button>
                {/* 로그인 확인 전에도 줄 자리를 잡아 둔다(늦게 끼어들면 아래 편성판이 밀린다) */}
                {authStatus !== 'authenticated' && (
                  <div className="flex w-full flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[0.8125rem] text-[var(--text-muted)]" style={authStatus === 'loading' ? { visibility: 'hidden' } : undefined}>
                    <p>
                      {getGuestCopy(locale).saveHint}{' '}
                      <Link href="/guest" className="text-[var(--gold-light)] underline-offset-4 hover:underline">{getGuestCopy(locale).manage}</Link>
                    </p>
                    {!editMode && (
                      <label className="flex items-center gap-2 font-semibold text-[var(--text-secondary)]">
                        {getGuestCopy(locale).pin}
                        <GuestPinInput value={pin} onChange={setPin} locale={locale} className="h-8 w-32 rounded px-3 outline-none"
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.875rem' }} />
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="deck-workspace-fields">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{builderT('fields.title')}</span>
                <input
                  type="text"
                  placeholder={builderT('fields.titlePlaceholder')}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="min-h-10 w-full rounded px-3 outline-none sm:min-h-11"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </label>


              <div className="min-w-0">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{builderT('fields.contentType')}</span>
                  {!contentType && <span style={{ color: 'var(--warning)', fontSize: '0.875rem', opacity: 0.85 }}>{builderT('fields.required')}</span>}
                </div>
                <Dropdown value={contentType} onChange={setContentType} ariaLabel={builderT('fields.contentType')} options={[{value:'',label:builderT('fields.contentType')},...CONTENT_TYPES.map(ct=>({value:ct,label:deckT(`contentTypes.${contentTypeMessageKey(ct)}`)}))]} buttonStyle={{minHeight:'2.75rem',width:'100%',fontSize:'.9375rem'}} />
              </div>
            </div>
          </div>
        </header>

        <div className="deck-workspace-formation">
        {/* 탭 바 — 밑줄 인디케이터 (플래너 패턴) */}
        <UnderlineTabBar
          tabs={tabItems}
          activeKey={tab}
          onTabChange={key => setTab(key as Tab)}
          className="mb-4"
        />

        {/* 탭 콘텐츠 */}
        {tab === 'identity' && (
          <m.section
            key="identity"
            className="deck-builder-identity-section"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >


            <IdentityTab
              sinners={sinners}
              identities={identities}
              deckSlots={deckSlots}
              upties={upties}
              egoSlots={egoSlots}
              skillsByIdentityId={skillsByIdentityId}
              skillDistribution={skillDistribution}
              mainKeywordCounts={deckKeywordCounts}
              selectedMainKeywords={effectiveMainKeywords}
              maxMainKeywords={MAX_DECK_MAIN_KEYWORDS}
              mainKeywordLabel={deckT('filters.alwaysKeywords')}
              formationOrder={formationOrder}
              onFormationToggle={handleFormationToggle}
              onFormationReset={() => setFormationOrder([])}
              onMainKeywordToggle={handleMainKeywordToggle}
              onIdentitySelect={(identity, uptie) => {
                if (!identity) return
                setDeckSlots(prev => ({ ...prev, [identity.sinner_id]: identity }))
                setUpties(prev => ({ ...prev, [identity.sinner_id]: uptie }))
              }}
            />

          </m.section>
        )}
        {tab === 'ego' && (
          <m.div
            key="ego"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <EgoTab
              sinners={sinners}
              egos={egos}
              egoSlots={egoSlots}
              identities={identities}
              identityIds={Object.fromEntries(Object.entries(deckSlots).map(([sinnerId, identity]) => [sinnerId, identity?.id]))}
              lang={locale as SupportedLang}
              onEgoSelect={ego => {
                setEgoSlots(prev => ({
                  ...prev,
                  [ego.sinner_id]: { ...(prev[ego.sinner_id] ?? {}), [ego.grade]: ego }
                }))
              }}
              onEgoDeselect={(sinnerId, grade) => {
                if (grade === 'ZAYIN') return
                setEgoSlots(prev => {
                  const s = { ...(prev[sinnerId] ?? {}) }
                  delete s[grade]
                  return { ...prev, [sinnerId]: s }
                })
              }}
            />
          </m.div>
        )}
        {tab === 'skillset' && (
          <m.div
            key="skillset"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SkillsetTab
              sinners={sinners}
              deckSlots={deckSlots}
              upties={upties}
              skillsByIdentityId={skillsByIdentityId}
              skillDistribution={skillDistribution}
              onDistributionChange={(sinnerId, dist) =>
                setSkillDistribution(prev => ({ ...prev, [sinnerId]: dist }))
              }
            />
          </m.div>
        )}
        {/* 편성 순서 탭 → 인격 탭 40%/60% 호버로 통합 */}

        {/* ── 키워드 분포 + 패시브 + 공격 유형/죄악 자원 (플래너와 같은 패널) ── */}
        {tab !== 'note' && deckInsights.identities.length > 0 && (
          <DeckInsights
            identities={deckInsights.identities}
            deployedIds={deckInsights.deployedIds}
            sinCounts={deckInsights.sinCounts}
            baseSinCounts={deckInsights.baseSinCounts}
            summary={deckInsights.summary}
          />
        )}

        {/* 덱 노트 */}
        {tab === 'note' && (
          <m.div
            key="note"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <DeckNoteEditor
              sinners={sinners}
              identities={identities}
              deckSlots={deckSlots}
              egoSlots={egoSlots}
              skillsByIdentityId={skillsByIdentityId}
              passivesByIdentityId={passivesByIdentityId}
              egoGifts={egoGifts}
              formationOrder={formationOrder}
              formationGiftKeywordCounts={formationGiftKeywordCounts}
              allGiftKeywordCounts={allGiftKeywordCounts}
              locale={locale as SupportedLang}
              description={description}
              setDescription={setDescription}
              descPreview={descPreview}
              setDescPreview={setDescPreview}
            />
          </m.div>
        )}
        </div>

        <style jsx global>{`
          @media (max-width: 639px) {
            .deck-builder-identity-section {
              padding: 0.625rem;
              border: 1px solid rgba(200, 144, 10, 0.12);
              border-radius: 0.5rem;
              background: rgba(18, 14, 9, 0.42);
            }
          }
        `}</style>
      </div>

      {/* Toast는 Sonner가 글로벌로 처리 */}
    </div>
  )
}

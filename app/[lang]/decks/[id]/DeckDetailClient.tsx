'use client'

import BackLink from '@/components/navigation/BackLink'
import PostAuthorName from '@/features/community/components/PostAuthorName'
import FollowAuthorButton from '@/features/community/components/FollowAuthorButton'
import SeriesBox from '@/features/community/components/SeriesBox'
import type { SeriesView } from '@/features/community'
import DeckDetailSkeleton from '@/app/[lang]/decks/[id]/_components/DeckDetailSkeleton'
import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import Image from 'next/image'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useLocale, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Heart, Bookmark, Share2, GitFork, Copy, Check, Pencil, Trash2 } from 'lucide-react'
import { showSuccess, showError } from '@/lib/toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useGuestPosts } from '@/features/account/hooks/useGuestPosts'
import { guestHeaders, getGuestCopy, guestAuthorName } from '@/features/account'
import GuestPinRecover from '@/features/account/components/GuestPinRecover'
import { DEFAULT_AVATAR_URL, SINNER_SLUGS } from '@/lib/constants/game'
import { getSkillIconUrl, computeSkillImageIndices } from '@/lib/utils/images'
import { NoteRenderer, fetchNoteGifts } from '@/features/notes/components/NoteChips'
import { NoteGiftClickContext } from '@/features/notes/components/NoteBlockViewer'
import PlannerGiftModal from '@/features/planner/components/PlannerGiftModal'
import type { GiftData } from '@/lib/planner/types'
import KeywordIcon from '@/components/ui/KeywordIcon'
import RelativeTime from '@/components/ui/RelativeTime'
import DeckInsights from '@/features/decks/components/DeckInsights'
import DeckResourceSummary from '@/features/decks/components/DeckResourceSummary'
import SkillExchangePanel from '@/components/ui/SkillExchangePanel'
import { CONTENT_TYPE_COLORS } from '@/lib/constants/deck-tokens'
import { topUptieSkills, BOARD_SLOT_COUNT, adaptBoardIdentity, contentTypeMessageKey, localizeDeckKeyword } from '@/features/decks'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { localizeIdentityName } from '@/lib/decks/localize'
import { type IdentityDetail, type IdentitySlot } from '@/lib/decks/identity-types'
import FormationBoard, { type FormationBoardSlot } from '@/features/decks/components/FormationBoard'
import { FormationTabs } from '@/features/decks/components/FormationEgoGrid'
import DeckRecommendations, { type DeckRecommendationsData } from '@/features/decks/components/DeckRecommendations'
import DeckComments from '@/features/decks/components/DeckComments'
import { useDeckDetailActions } from '@/features/decks/hooks/useDeckDetailActions'
import { useDeckDetailLoad, useDeckDetailState, type DeckDetail } from '@/features/decks/hooks/useDeckDetailData'
import { buildSkillExchangeRow, computeDeckAnalysis, slotUptie, useDeckDetailModel } from '@/features/decks/hooks/useDeckDetailModel'
import { useDeckReactions } from '@/features/decks/hooks/useDeckReactions'
import { useSectionNav } from '@/features/decks/hooks/useSectionNav'
import type { SupportedLang } from '@/lib/i18n/types'
import { workbenchReveal } from '@/lib/animations'
import styles from './DeckDetail.module.css'

const IdentityDetailModal = dynamic(() => import('@/features/catalog/components/IdentityDetailModal'), { ssr: false })
const EgoDetailModal = dynamic(() => import('@/features/catalog/components/EgoDetailModal'), { ssr: false })

import AdSlot from '@/components/ads/AdSlot'
import { ADS_ON } from '@/lib/seo/ads'

type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  username: string | null
  avatar_url: string | null
  role?: string
}

type IdentityPreviewState = {
  slot: IdentitySlot
}

type DeckDetailClientProps = {
  id: string
  initialDeck?: DeckDetail | null
  initialComments?: Comment[]
  initialRecommendations?: DeckRecommendationsData | null
  initialSeries?: SeriesView | null
  /** The "함께 본 글" lane, streamed by the server; empty when there is nothing to show. */
  coVisited?: ReactNode
}

export default function DeckDetailClient({ id, initialDeck, initialComments, initialRecommendations, initialSeries, coVisited }: DeckDetailClientProps) {
  const router = useRouter()
  const locale = useLocale() as SupportedLang
  const t = useTranslations('decks.detail')
  const rootT = useTranslations()
  const shouldReduceMotion = useReducedMotion()
  const { status: authStatus } = useSession()

  // The requests start in this order: the guest's posts, the vote, the bookmark, the gift list, then the view count and the deck.
  const { deck, setDeck, loading, setLoading } = useDeckDetailState(initialDeck)
  // Signed-out visitors own a guest deck when this browser's key wrote it.
  const guest = useGuestPosts(authStatus === 'unauthenticated' && !deck?.user_id), guestPosts = guest.posts
  const guestOwner = authStatus === 'unauthenticated' && !!guestPosts.data?.decks.some(post => post.id === id)
  // A guest deck this browser has no key for: its author takes it back with the deck's password.
  const canRecover = authStatus === 'unauthenticated' && !!deck?.guest_tag && guest.keyRead && !guestPosts.isLoading && !guestOwner
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { voted, voteCount, setVoteCount, voting, handleVote, bookmarked, bookmarking, handleBookmark } = useDeckReactions({ id, authStatus, initialVoteCount: initialDeck?.vote_count ?? 0 })
  const [identityPreview, setIdentityPreview] = useState<IdentityPreviewState | null>(null)
  const [formationTab, setFormationTab] = useState<'identity' | 'ego' | 'skill'>('identity')

  // Same key and fetcher as the card previews' gift lookup, so SWR downloads the gift list once.
  const { data: noteGifts } = useSWR('/api/ego-gifts', fetchNoteGifts, { revalidateOnFocus: false, revalidateIfStale: false })
  const egoGiftLookup = useMemo(() => Object.fromEntries((noteGifts ?? []).map(gift => [gift.name, gift])), [noteGifts])
  useDeckDetailLoad({ id, initialDeck, setDeck, setLoading, onVoteCount: setVoteCount })
  const [egoModalId, setEgoModalId] = useState<string | null>(null)
  // A gift label in the note: the list above is the light one, so the pressed gift is fetched whole for the modal.
  const [noteGift, setNoteGift] = useState<GiftData & { named_gifts?: GiftData[] } | null>(null)
  const openNoteGift = useCallback((key: string) => {
    fetch(`/api/ego-gifts?key=${encodeURIComponent(key)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((gift: GiftData & { named_gifts?: GiftData[] } | null) => { if (gift) setNoteGift({ ...gift, theme_ids: null }) })
      .catch(() => {})
  }, [])

  const { copied, shared, shareGenerating, handleCopyCode, handleShare, handleFork } = useDeckDetailActions({ id, locale, deck })

  // 카드 아래 줄: 스킬 1·2·3의 아이콘, 죄악, 공격 유형 (스킬 분포 패널과 같은 아이콘 규칙)
  const stripSkills = (identity: IdentityDetail, counts: (number | null | undefined)[]) => {
    const attacks = topUptieSkills((identity.skills ?? []).filter(skill => !['evade', 'defense', 'counter'].includes(skill.skill_type))).sort((a, b) => a.skill_order - b.skill_order)
    const imageIndices = computeSkillImageIndices(attacks)
    return [1, 2, 3].map(order => {
      const skill = attacks.find(row => row.skill_order === order)
      return skill ? { iconUrl: getSkillIconUrl(adaptBoardIdentity(identity, locale), imageIndices[skill.id] ?? order, skill), sin: skill.sin_affinity, attackType: skill.atk_type ?? null, count: counts[order - 1] ?? 4 - order } : null
    })
  }
  const { boardSlots, formationEgos, keywords, filledSlots, formedSlots, customSkillSlots, egoGrouped, noteLookups, egoGiftConditionLookup, insightSlots, deployedIdentityIds, insightIdentities } = useDeckDetailModel({
    deckIdentities: deck?.deck_identities, deckEgos: deck?.deck_egos, mainKeywords: deck?.main_keywords, allSinnerEgos: deck?.all_sinner_egos, locale, egoGiftLookup,
  })

  useEffect(() => {
    if (loading || deck) return

    const styleId = 'deck-detail-missing-footer-style'
    const className = 'deck-detail-missing'
    let styleElement = document.getElementById(styleId)

    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = styleId
      styleElement.textContent = `body.${className} .site-footer { display: none !important; }`
      document.head.appendChild(styleElement)
    }

    document.body.classList.add(className)

    return () => {
      document.body.classList.remove(className)
      if (styleElement?.parentNode) {
        styleElement.parentNode.removeChild(styleElement)
      }
    }
  }, [deck, loading])

  const decksT = useTranslations('decks')
  const commentsT = useTranslations('decks.comments')
  const { getIconUrl, keywords: keywordMessages } = useKeywordData()

  const deckAnalysis = useMemo(() => {
    const { resources, sinCounts, baseSinCounts } = computeDeckAnalysis(deck?.deck_egos ?? [], insightSlots)
    return { sinCounts, baseSinCounts, summary: <DeckResourceSummary resources={resources} /> }
  }, [deck?.deck_egos, insightSlots])

  const hasRecommendations = [...(initialRecommendations?.otherOpinions ?? []), ...(initialRecommendations?.similarDecks ?? [])].some(rec => rec.id !== id)
  const hasNote = Boolean(deck?.description?.trim()) || customSkillSlots.length > 0
  // a second detail banner under the line after the deck note (the skill distribution) or the formation, above the related
  // decks (owner, 2026-11-07: "선 밑에")
  const lowerAd = ADS_ON && <div className={`${styles.section} ${styles.adSection}`}><AdSlot place="inline" /></div>
  const sections: { id: string; label: string }[] = [
    { id: 'deck-formation', label: t('sectionFormation') },
    ...(hasNote ? [{ id: 'deck-note', label: t('deckNote') }] : []),
    ...(hasRecommendations ? [{ id: 'deck-similar', label: t('sectionRelated') }] : []),
    { id: 'deck-comments', label: commentsT('title') },
  ]
  const sectionKey = sections.map(section => section.id).join()
  const { activeSection, sectionNavRef, goToSection } = useSectionNav(sectionKey, loading, 'deck-formation')

  if (loading) return <DeckDetailSkeleton />

  if (!deck) {
    return (
      <div
        className="flex items-center justify-center px-4"
        style={{ minHeight: 'calc(100dvh - 4rem)', background: 'var(--bg-deep)' }}
      >
        <div className="text-center">
          <p className="mb-4 font-serif text-2xl" style={{ color: 'var(--gold)' }}>{t('notFound')}</p>
          <Link
            href="/decks"
            locale={locale}
            style={{ color: '#888888' }}
            className="transition-colors hover:text-yellow-300"
          >
            {t('backToBoard')}
          </Link>
        </div>
      </div>
    )
  }

  const contentLabel = deck.content_type && deck.content_type !== '없음'
    ? decksT(`contentTypes.${contentTypeMessageKey(deck.content_type)}`)
    : null
  const canEdit = deck.is_owner || deck.is_admin || guestOwner
  const guestT = getGuestCopy(locale)
  const deleteGuestDeck = async () => {
    setConfirmDelete(false)
    const res = await fetch(`/api/decks/${id}`, { method: 'DELETE', headers: guestHeaders(false) }).catch(() => null)
    if (!res?.ok) { showError(guestT.deleteFailed); return }
    void guestPosts.mutate()
    showSuccess(guestT.deleted)
    router.push('/decks')
  }

  return (
    <NoteGiftClickContext value={openNoteGift}>
    <div className="min-h-screen bg-[var(--bg-deep)] pt-24 pb-20">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
        <BackLink
          href="/decks"
          locale={locale}
          className="mb-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm px-1 text-[0.9375rem] font-medium text-[#9c8b73] transition-colors hover:text-[var(--gold-light)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('backToList')}
        </BackLink>

        <m.header
          className={styles.hero}
          variants={shouldReduceMotion ? undefined : workbenchReveal}
          initial={shouldReduceMotion ? false : 'initial'}
          animate={shouldReduceMotion ? undefined : 'animate'}
        >
          <div className={styles.identity}>
            <div className={styles.lead}>
            {contentLabel && <span className={styles.content} style={{ color: CONTENT_TYPE_COLORS[deck.content_type!]?.color }}>{contentLabel}</span>}
            {keywords.length > 0 && (
              <ul className={styles.keywords}>
                {keywords.map(keyword => {
                  const iconUrl = getIconUrl(keyword)
                  return (
                    <li key={keyword}>
                      {iconUrl && <KeywordIcon src={iconUrl} alt="" width={28} height={28} className="h-7 w-7 object-contain" />}
                      {localizeDeckKeyword(keyword, keywordMessages[keyword], locale)}
                    </li>
                  )
                })}
              </ul>
            )}
            </div>
            <h1 className={styles.title}>{deck.title}</h1>
            {initialSeries && <SeriesBox series={initialSeries} kind="deck" postId={id} />}
          </div>

          <div className={styles.author}>
            <Image src={deck.profiles?.avatar_url || DEFAULT_AVATAR_URL} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full bg-[#17120c] object-cover ring-1 ring-[#6b4c12]" />
            <div className="min-w-0">
              <PostAuthorName
                userId={deck.profiles?.username ? deck.user_id : null}
                username={deck.profiles?.username ?? guestAuthorName(deck.guest_tag, locale) ?? commentsT('anonymous')}
                profilePublic={deck.profiles?.public_profile}
                className="block truncate text-[1rem] font-semibold leading-snug text-[var(--text-primary)] hover:text-[var(--gold-light)]"
              />
              <p className="flex gap-3 text-[0.875rem] text-[#9c8b73]">
                <RelativeTime date={deck.created_at} />
                <span>{t('factViews')} <span className="tabular-nums">{deck.view_count}</span></span>
              </p>
            </div>
            {deck.profiles?.username && deck.profiles.public_profile !== false && <FollowAuthorButton userId={deck.user_id} />}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleVote}
              disabled={authStatus !== 'authenticated' || voting}
              aria-pressed={voted}
              title={authStatus !== 'authenticated' ? t('loginToVote') : voted ? t('undoVote') : t('vote')}
            >
              <Heart className="h-4 w-4" fill={voted ? 'currentColor' : 'none'} aria-hidden="true" />
              {t('vote')} {voteCount}
            </button>
            <button
              type="button"
              onClick={handleBookmark}
              disabled={authStatus !== 'authenticated' || bookmarking}
              aria-pressed={bookmarked}
              title={authStatus !== 'authenticated' ? t('loginToBookmark') : bookmarked ? t('undoBookmark') : t('bookmark')}
            >
              <Bookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} aria-hidden="true" />
              {bookmarked ? t('saved') : t('save')}
            </button>
            <button type="button" onClick={handleShare} disabled={shareGenerating} data-done={shared || undefined}>
              {shared ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
              {shared ? t('copied') : t('share')}
            </button>
            {deck.deck_code && (
              <button type="button" onClick={handleCopyCode} data-done={copied || undefined}>
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? t('copied') : t('copyDeckCode')}
              </button>
            )}
            {canEdit && (
              <Link href={`/decks/${id}/edit`} className={styles.edit}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                {t('editDeck')}
              </Link>
            )}
            {guestOwner && (
              <button type="button" onClick={() => setConfirmDelete(true)} style={{ color: '#e8a08a' }}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {rootT('common.delete')}
              </button>
            )}
            {canRecover && <GuestPinRecover kind="deck" id={id} onRecovered={() => { guest.reloadKey(); void guestPosts.mutate() }} />}
            <button type="button" onClick={handleFork} data-primary>
              <GitFork className="h-4 w-4" aria-hidden="true" />
              {t('forkDeck')}
            </button>
          </div>
        </m.header>

        <nav aria-label={t('sectionNav')} className={`sticky-under-nav ${styles.sectionNav}`}>
          <ol ref={sectionNavRef}>
            {sections.map(section => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  aria-current={activeSection === section.id ? 'location' : undefined}
                  onClick={event => { event.preventDefault(); goToSection(section.id) }}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="min-w-0 overflow-x-clip">
          {/* a small banner under the section tabs, before the line-up heading (DESIGN.md "광고") */}
          <AdSlot place="inline" />
          <section id="deck-formation" aria-labelledby="deck-formation-title" className={styles.section}>
            <SectionHead id="deck-formation-title" title={t('sectionFormation')} />
            {filledSlots.length === 0 ? (
              <p className={styles.empty}>{t('identityEmpty')}</p>
            ) : (
              <>
                <FormationTabs
                  tabs={[
                    { key: 'identity', label: rootT('planner.deckTab.subTabs.identity'), count: `${formedSlots.length}/${BOARD_SLOT_COUNT}` },
                    { key: 'ego', label: rootT('planner.deckTab.subTabs.ego'), count: String(deck.deck_egos?.filter(row => row.ego).length ?? 0) },
                    { key: 'skill', label: rootT('identity.tab.skills') },
                  ]}
                  active={formationTab}
                  onChange={setFormationTab}
                  label={rootT('planner.deckTab.subTabs.label')}
                />
                <FormationBoard
                  view={formationTab}
                  onEgoClick={setEgoModalId}
                  slots={boardSlots.map((slot, index): FormationBoardSlot => {
                    const identity = slot?.identities ?? null
                    const identityName = identity ? localizeIdentityName(identity, locale) : ''
                    return {
                      key: `${identity?.id ?? 'empty'}-${index}`,
                      identity: identity ? adaptBoardIdentity(identity, locale) : null,
                      sinnerId: SINNER_SLUGS[index],
                      slotOrder: slot?.slot_order ?? null,
                      uptie: slotUptie(slot),
                      skills: identity ? stripSkills(identity, [slot?.s1_count, slot?.s2_count, slot?.s3_count]) : undefined,
                      egos: formationEgos[SINNER_SLUGS[index]] ?? {},
                      ariaLabel: identity ? t('slotPreview', { index: index + 1, identity: identityName }) : t('emptySlot', { index: index + 1 }),
                      onClick: identity && slot ? () => setIdentityPreview({ slot }) : undefined,
                    }
                  })}
                />

                {formationTab === 'identity' && <DeckInsights identities={insightIdentities} sinCounts={deckAnalysis.sinCounts} baseSinCounts={deckAnalysis.baseSinCounts} summary={deckAnalysis.summary} deployedIds={deployedIdentityIds} />}
              </>
            )}
          </section>

          {hasNote && (
            <section id="deck-note" aria-labelledby="deck-note-title" className={styles.section}>
              <SectionHead id="deck-note-title" title={t('deckNote')} />
              {deck.description?.trim() && (
                <div className={styles.note} data-note-wrap>
                  <NoteRenderer
                    text={deck.description}
                    {...noteLookups}
                    egoGiftLookup={egoGiftLookup}
                    egoGiftConditionLookup={egoGiftConditionLookup}
                    textScale="comfortable"
                    anchors
                  />
                </div>
              )}
              {customSkillSlots.length > 0 && (
                <div className={styles.block}>
                  <h3 className={styles.subhead}>{t('skillDistribution')}</h3>
                  <div className="skill-exchange-list">
                    {customSkillSlots.map((slot, i) => {
                      const identity = slot.identities!
                      const row = buildSkillExchangeRow(slot, locale, rootT(`sinner.${identity.sinner_id}`))
                      return (
                        <SkillExchangePanel
                          key={`${identity.id}-${i}`}
                          identity={row.identity}
                          onIdentityClick={() => setIdentityPreview({ slot })}
                          distribution={row.distribution}
                          skills={row.skills}
                          readOnly
                          showTotal={false}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {lowerAd}

          {hasRecommendations ? (
            <section id="deck-similar" aria-labelledby="deck-similar-title" className={styles.section}>
              <SectionHead id="deck-similar-title" title={t('sectionRelated')} />
              <DeckRecommendations recommendations={initialRecommendations} currentDeckId={id} />
              <div className="mt-8 empty:hidden">{coVisited}</div>
            </section>
          ) : (
            <section className={`${styles.section} empty:hidden`}>{coVisited}</section>
          )}

          <section id="deck-comments" aria-labelledby="deck-comments-title" className={styles.section}>
            <DeckComments deckId={id} initialComments={initialComments ?? []} headingId="deck-comments-title" />
          </section>
        </main>
      </div>

      {identityPreview?.slot.identities && (
        <IdentityDetailModal
          identityId={identityPreview.slot.identities.id}
          uptie={slotUptie(identityPreview.slot)}
          egos={egoGrouped[identityPreview.slot.identities.sinner_id] ?? []}
          onEgoClick={setEgoModalId}
          onClose={() => setIdentityPreview(null)}
        />
      )}
      {egoModalId && (
        <EgoDetailModal egoId={egoModalId} onClose={() => setEgoModalId(null)} />
      )}
      {noteGift && <PlannerGiftModal gift={noteGift} onClose={() => setNoteGift(null)} gifts={noteGift.named_gifts} />}
      <ConfirmModal
        open={confirmDelete}
        title={guestT.deleteDeckTitle}
        message={guestT.deleteDeckMessage}
        confirmLabel={rootT('common.delete')}
        cancelLabel={rootT('common.cancel')}
        variant="danger"
        onConfirm={deleteGuestDeck}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
    </NoteGiftClickContext>
  )
}

function SectionHead({ id, title, meta }: { id: string; title: string; meta?: string }) {
  return (
    <div className="mb-5 flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="font-[family-name:var(--font-heading)] text-[1.375rem] leading-snug text-[var(--text-primary)] sm:text-[1.5rem]">{title}</h2>
      {meta && <p className="text-[0.875rem] text-[#9c8b73]">{meta}</p>}
    </div>
  )
}

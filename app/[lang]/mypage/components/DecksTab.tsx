'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Bookmark, Layers, Plus, Trash2, X } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import DeckCard, { type DeckSummary } from '@/components/decks/DeckCard'
import { getCommunityCopy } from '@/lib/community/copy'
import styles from '@/components/community/profile.module.css'

export default function DecksTab({ decks, bookmarkedDecks, onDeleteDeck, onRemoveBookmark }: {
  decks: DeckSummary[]
  bookmarkedDecks: DeckSummary[]
  onDeleteDeck: (id: string) => Promise<void>
  onRemoveBookmark: (id: string) => Promise<void>
}) {
  const t = getCommunityCopy(useLocale())
  const [subTab, setSubTab] = useState<'mine' | 'saved'>('mine')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const list = subTab === 'mine' ? decks : bookmarkedDecks
  return (
    <>
      <div className={styles.head}>
        <div className={styles.seg} role="group" aria-label={t.decks}>
          <button type="button" aria-pressed={subTab === 'mine'} onClick={() => setSubTab('mine')}>{t.myDecks}<b>{decks.length}</b></button>
          <button type="button" aria-pressed={subTab === 'saved'} onClick={() => setSubTab('saved')}>{t.savedDecks}<b>{bookmarkedDecks.length}</b></button>
        </div>
        <Link href="/decks/new" className={styles.primary}><Plus aria-hidden="true" />{t.newDeck}</Link>
      </div>
      {list.length === 0 ? (
        <div className={styles.empty}>
          {subTab === 'mine' ? <Layers aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
          <p>{subTab === 'mine' ? t.emptyDecks : t.emptySaved}</p>
          <Link href={subTab === 'mine' ? '/decks/new' : '/decks'} className={subTab === 'mine' ? styles.primary : styles.ghost}>
            {subTab === 'mine' ? t.firstDeck : t.browseDecks}
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {list.map(deck => (
            <li key={deck.id} className={styles.item}>
              <DeckCard deck={deck} />
              {subTab === 'saved' ? (
                <button type="button" className={styles.itemAction} onClick={() => onRemoveBookmark(deck.id)} aria-label={t.removeBookmark} title={t.removeBookmark}><X aria-hidden="true" /></button>
              ) : deletingId === deck.id ? (
                <div className={styles.confirm}>
                  {t.deleteDeckAsk}
                  <div>
                    <button type="button" className={styles.ghost} onClick={() => setDeletingId(null)}>{t.cancel}</button>
                    <button type="button" className={`${styles.primary} ${styles.danger}`} onClick={async () => { await onDeleteDeck(deck.id); setDeletingId(null) }}>{t.delete}</button>
                  </div>
                </div>
              ) : (
                <button type="button" className={styles.itemAction} onClick={() => setDeletingId(deck.id)} aria-label={t.deleteDeck} title={t.deleteDeck}><Trash2 aria-hidden="true" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

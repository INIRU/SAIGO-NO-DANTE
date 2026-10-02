'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Bell, MessageCircle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import RelativeTime from '@/components/ui/RelativeTime'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import type { Notification } from '@/lib/notifications'
import { NavAvatar, NavLink, focusRing } from './nav-shared'
import styles from './NavNotifications.module.css'

interface CardProps {
  /** The commenter's picture; null draws the support desk's mark instead. */
  avatar: string | null
  /** Who did what, with the name in <b>. */
  sentence: ReactNode
  /** The comment's first words. */
  words?: string
  unread: boolean
  /** Screen-reader name of the unread dot. */
  newLabel: string
  time?: ReactNode
}

/**
 * One notification row: picture, a line saying who did what, a line of the comment, the time and a dot while unread.
 * It reads no translations itself, because a toast renders it outside the page's message provider.
 */
function NotificationCard({ avatar, sentence, words, unread, newLabel, time }: CardProps) {
  return (
    <span className={styles.card} data-unread={unread || undefined}>
      {avatar ? <NavAvatar url={avatar} size="2.25rem" /> : <span className={styles.support}><MessageCircle size={17} aria-hidden="true" /></span>}
      <span className="min-w-0">
        <span className={styles.line}>{sentence}</span>
        {words && <span className={`${styles.line} ${styles.words}`}>{words}</span>}
      </span>
      <span className={styles.aside}>
        {unread && <span className={styles.dot}><span className="sr-only">{newLabel}</span></span>}
        {time}
      </span>
    </span>
  )
}

type Translate = ReturnType<typeof useTranslations>
/** "<b>name</b> commented on title" in the reader's language. */
export const sentenceOf = (item: Notification, t: Translate): ReactNode =>
  t.rich(item.kind, { name: item.actor ?? t('someone'), title: item.title, b: chunks => <b>{chunks}</b> })

/** The panel's list: a support reply first, then comments and replies, newest first. */
export function NotificationList({ items, supportUnread = false, onNavigate }: { items: Notification[]; supportUnread?: boolean; onNavigate: () => void }) {
  const t = useTranslations('notifications')
  if (!items.length && !supportUnread) {
    return (
      <p className="flex flex-col items-center gap-3 px-6 py-10 text-center text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
        <Bell size={24} aria-hidden="true" className="opacity-50" />
        {t('empty')}
      </p>
    )
  }
  return (
    <ul className={styles.list}>
      {supportUnread && (
        <li className={styles.row} style={{ '--i': 0 } as CSSProperties}>
          <NavLink href="/support" onClick={onNavigate} className={`${styles.item} ${focusRing}`}>
            <NotificationCard avatar={null} sentence={t.rich('supportReply', { b: chunks => <b>{chunks}</b> })} unread newLabel={t('new')} />
          </NavLink>
        </li>
      )}
      {items.map((item, index) => (
        <li key={item.id} className={styles.row} style={{ '--i': Math.min(index + (supportUnread ? 1 : 0), 8) } as CSSProperties}>
          <NavLink href={item.href} onClick={onNavigate} className={`${styles.item} ${focusRing}`}>
            <NotificationCard avatar={item.avatar || DEFAULT_AVATAR_URL} sentence={sentenceOf(item, t)} words={item.excerpt} unread={item.unread} newLabel={t('new')}
              time={item.at && <RelativeTime date={item.at} />} />
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

/**
 * A new notification as a toast (sonner's `toast.custom`): the same row; pressing it opens the panel. `sentence` and
 * `closeLabel` come translated, because the toaster sits outside the page's message provider.
 */
export function NotificationToast({ item, sentence, closeLabel, onOpen, onClose }: { item: Notification; sentence: ReactNode; closeLabel: string; onOpen: () => void; onClose: () => void }) {
  return (
    <div className={styles.toast}>
      <button type="button" className={styles.toastOpen} onClick={onOpen}>
        <NotificationCard avatar={item.avatar || DEFAULT_AVATAR_URL} sentence={sentence} words={item.excerpt} unread={false} newLabel="" />
      </button>
      <button type="button" className={styles.toastClose} aria-label={closeLabel} onClick={onClose}><X size={15} aria-hidden="true" /></button>
    </div>
  )
}

interface Props {
  items: Notification[]
  /** The bell's count: unread comment notifications plus one for a support reply. */
  unread: number
  /** A support inquiry has a reply its owner has not read: the list's first row. */
  supportUnread: boolean
  open: boolean
  onToggle: () => void
  onClose: () => void
  /** The phone navbar's bell: a larger button, and the card is placed against the navbar's right edge. */
  mobile?: boolean
}

/** The navbar bell with its unread count, and the panel it opens. The navbar renders one per layout and owns `open`. */
export default function NavNotifications({ items, unread, supportUnread, open, onToggle, onClose, mobile = false }: Props) {
  const t = useTranslations('notifications')
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: MouseEvent) => {
      // The other layout's bell is not displayed (offsetParent is null): only the visible one decides.
      if (root.current?.offsetParent && !root.current.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open, onClose])
  const fresh = items.filter(item => item.unread).length + (supportUnread ? 1 : 0)
  return (
    <div ref={root} className={mobile ? 'flex' : 'relative flex'}>
      <button
        type="button"
        data-testid="nav-notify-bell"
        onClick={onToggle}
        aria-label={unread > 0 ? `${t('title')}, ${t('unread', { count: unread })}` : t('title')}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative flex cursor-pointer items-center justify-center rounded-md transition-colors duration-150 hover:bg-[rgba(200,144,10,0.08)] hover:text-[var(--gold-light)] ${mobile ? 'h-11 w-11' : 'h-9 w-9'} ${open ? 'bg-[rgba(200,144,10,0.08)] text-[var(--gold-light)]' : 'text-[var(--text-secondary)]'} ${focusRing}`}
      >
        <Bell size={mobile ? 20 : 17} aria-hidden="true" className={unread > 0 ? styles.swing : undefined} />
        {unread > 0 && <span aria-hidden="true" data-testid="nav-notify-badge" className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label={t('title')} className={`${styles.panel} ${mobile ? styles.floating : styles.popover}`}>
          <h2 className={styles.head}>
            {t('title')}
            {fresh > 0 && <span className={styles.count}>{t('newCount', { count: fresh })}</span>}
          </h2>
          <NotificationList items={items} supportUnread={supportUnread} onNavigate={onClose} />
        </div>
      )}
    </div>
  )
}

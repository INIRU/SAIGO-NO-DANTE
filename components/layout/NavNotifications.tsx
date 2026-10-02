'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { Bell, CornerDownRight, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import RelativeTime from '@/components/ui/RelativeTime'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import type { Notification } from '@/lib/notifications'
import { NavAvatar, NavLink, focusRing } from './nav-shared'
import styles from './NavNotifications.module.css'

/** The panel's list: who wrote, when, the comment's first lines, and whether it is a comment or a reply on which post. */
export function NotificationList({ items, supportUnread = false, onNavigate }: { items: Notification[]; supportUnread?: boolean; onNavigate: () => void }) {
  const t = useTranslations('notifications')
  if (!items.length && !supportUnread) {
    return (
      <p className="flex flex-col items-center gap-3 px-4 py-11 text-[0.875rem] text-[var(--text-muted)]">
        <Bell size={24} aria-hidden="true" className="opacity-50" />
        {t('empty')}
      </p>
    )
  }
  return (
    <ul className={styles.list}>
      {supportUnread && (
        <li className={styles.row} style={{ '--i': 0 } as CSSProperties}>
          <NavLink href="/support" onClick={onNavigate} data-unread className={`${styles.item} ${focusRing}`}>
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--gold-dim)] bg-[var(--bg-panel)] text-[var(--gold-light)]">
              <MessageCircle size={18} aria-hidden="true" />
              <span className={styles.mark}><span className="sr-only">{t('new')}</span></span>
            </span>
            <span className="min-w-0 flex-1 self-center">
              <span className="block text-[0.875rem] font-semibold text-[var(--text-primary)]">{t('support')}</span>
              <span className="mt-1 block text-[0.875rem] leading-[1.45] text-[var(--text-secondary)]">{t('supportReply')}</span>
            </span>
          </NavLink>
        </li>
      )}
      {items.map((item, index) => {
        const Kind = item.kind === 'reply' ? CornerDownRight : MessageCircle
        return (
          <li key={item.id} className={styles.row} style={{ '--i': Math.min(index, 8) } as CSSProperties}>
            <NavLink href={item.href} onClick={onNavigate} data-unread={item.unread || undefined} className={`${styles.item} ${focusRing}`}>
              <span className="relative h-10 shrink-0">
                <NavAvatar url={item.avatar || DEFAULT_AVATAR_URL} size="2.5rem" />
                {item.unread && <span className={styles.mark}><span className="sr-only">{t('new')}</span></span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-[0.875rem] font-semibold text-[var(--text-primary)]">{item.actor ?? t('someone')}</span>
                  {item.at && <RelativeTime date={item.at} className="ml-auto shrink-0 text-[0.75rem] text-[var(--text-muted)]" />}
                </span>
                <span className="mt-1 line-clamp-2 break-words text-[0.875rem] leading-[1.45] text-[var(--text-secondary)]">{item.excerpt}</span>
                <span className="mt-2 flex items-center gap-2 text-[0.75rem]">
                  <span className="flex shrink-0 items-center gap-1 text-[var(--gold-light)]"><Kind size={12} aria-hidden="true" />{t(item.kind)}</span>
                  <span aria-hidden="true" className="h-3 w-px shrink-0 bg-[#3a2a15]" />
                  <span className="truncate text-[var(--text-tertiary)]">{item.title}</span>
                </span>
              </span>
            </NavLink>
          </li>
        )
      })}
    </ul>
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
  /** The phone navbar's bell: a larger button and a sheet under the navbar instead of a popover. */
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
        <div role="dialog" aria-label={t('title')} className={`${styles.panel} ${mobile ? styles.sheet : styles.popover}`}>
          <h2 className={styles.head}>
            {t('title')}
            {fresh > 0 && <span className={styles.count} aria-hidden="true">{fresh}</span>}
          </h2>
          <NotificationList items={items} supportUnread={supportUnread} onNavigate={onClose} />
        </div>
      )}
    </div>
  )
}

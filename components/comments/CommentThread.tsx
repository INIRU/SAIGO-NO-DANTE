'use client'

import { Fragment, type ReactNode } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { CornerDownRight, X } from 'lucide-react'
import RelativeTime from '@/components/ui/RelativeTime'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import { commentThreads } from '@/lib/comments/thread'

export type ThreadItem = { id: string; parent_id: string | null; created_at: string; content: string; name: string; avatar: string | null; badge?: ReactNode }

function CommentBody({ item, small, replyTo, footer }: { item: ThreadItem; small: boolean; replyTo?: string; footer?: ReactNode }) {
  const t = useTranslations('decks.comments')
  return (
    <div className="flex gap-3">
      <Image
        src={item.avatar || DEFAULT_AVATAR_URL} alt="" width={small ? 28 : 36} height={small ? 28 : 36}
        className={`${small ? 'h-7 w-7' : 'h-9 w-9'} shrink-0 rounded-full bg-[#17120c] object-cover`}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-[0.9375rem] font-semibold text-[#e8dcc8]">{item.name}</span>
          {item.badge}
          <RelativeTime date={item.created_at} className="text-[0.8125rem] text-[#7f7364]" />
        </p>
        {replyTo && (
          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[0.8125rem] text-[#9c8b73]">
            <CornerDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate text-[#c9a24a]">@{replyTo}</span>
            <span className="sr-only">{t('replyingToSuffix')}</span>
          </p>
        )}
        <p className="mt-1 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-[#cfc2ad]">{item.content}</p>
        {footer}
      </div>
    </div>
  )
}

/** The reply box under the comment being answered. */
export function CommentReplyForm({ targetName, value, onChange, onSubmit, onCancel, submitting }: {
  targetName: string; value: string; onChange: (value: string) => void; onSubmit: () => void; onCancel: () => void; submitting: boolean
}) {
  const t = useTranslations('decks.comments')
  const tCommon = useTranslations('common')
  return (
    <form onSubmit={event => { event.preventDefault(); onSubmit() }}>
      <div className="mb-2 flex items-center justify-between gap-3 rounded border border-[#3a2c14] bg-[#17120c] py-1 pl-3 pr-1 text-[0.875rem] text-[#e8b030]">
        <span className="min-w-0 truncate">@{targetName}{t('replyingToSuffix')}</span>
        <button type="button" onClick={onCancel} aria-label={tCommon('cancel')} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-[#9c8b73] hover:text-[#e8dcc8]">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-label={t('replyPlaceholder')}
        placeholder={t('replyPlaceholder')}
        maxLength={500}
        rows={2}
        autoFocus
        onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); onSubmit() } }}
        className="block w-full resize-y rounded-md border border-[#2e2417] bg-[#17120c] px-3 py-2.5 text-[0.9375rem] leading-relaxed text-[#e8dcc8] placeholder:text-[#7f7364] focus:border-[#c8900a] focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[0.8125rem] tabular-nums text-[#7f7364]">{value.length}/500</span>
        <button
          type="submit"
          disabled={submitting || !value.trim()}
          className="inline-flex min-h-10 items-center gap-2 rounded border border-[#8a6010] bg-[#2a1f0c] px-3.5 text-[0.875rem] font-semibold text-[#e8b030] transition-colors hover:border-[#c8900a] hover:bg-[#35270e] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? t('submitting') : t('replySubmit')}
        </button>
      </div>
    </form>
  )
}

/**
 * Comments with their replies at any depth, kept narrow: replies sit in one column under the root, and a reply to a
 * reply steps in once more and names the person it answers (deeper ones stay at that step). The reply box opens right
 * under the comment being answered, or at the end of the thread for the root.
 */
export default function CommentThread({ items, canReply, replyingTo, onReply, replyForm, actions }: {
  items: ThreadItem[]
  canReply: boolean
  /** The comment being answered, if any. */
  replyingTo: string | null
  onReply: (item: ThreadItem) => void
  replyForm: ReactNode
  /** Extra buttons after "reply" (delete), per comment. */
  actions?: (item: ThreadItem, isReply: boolean) => ReactNode
}) {
  const t = useTranslations('decks.comments')
  const footer = (item: ThreadItem, isReply: boolean) => (canReply || actions) && (
    <div className="mt-1 flex items-center gap-1">
      {canReply && (
        <button type="button" onClick={() => onReply(item)} aria-expanded={replyingTo === item.id} className="-ml-1 inline-flex min-h-9 items-center rounded px-1 text-[0.8125rem] text-[#9c8b73] hover:text-[#e8b030] aria-expanded:text-[#e8b030]">
          {t('reply')}
        </button>
      )}
      {actions?.(item, isReply)}
    </div>
  )
  return (
    <ol className="mt-6 max-w-[52rem] divide-y divide-[#241c14] border-t border-[#241c14]">
      {commentThreads(items).map(({ root, replies }) => {
        const rootReplying = replyingTo === root.id
        return (
          <li key={root.id} className="py-4">
            <CommentBody item={root} small={false} footer={footer(root, false)} />
            {(replies.length > 0 || rootReplying) && (
              <ol className="ml-3 mt-3 space-y-4 border-l border-[#2e2417] pl-3 sm:ml-[3rem] sm:pl-4">
                {replies.map(({ comment, depth, parent }) => (
                  <Fragment key={comment.id}>
                    <li data-depth={Math.min(depth, 2)} className={depth >= 2 ? 'ml-5 sm:ml-7' : undefined}>
                      <CommentBody item={comment} small replyTo={depth >= 2 ? parent?.name : undefined} footer={footer(comment, true)} />
                    </li>
                    {replyingTo === comment.id && <li className="ml-5 sm:ml-7">{replyForm}</li>}
                  </Fragment>
                ))}
                {rootReplying && <li>{replyForm}</li>}
              </ol>
            )}
          </li>
        )
      })}
    </ol>
  )
}

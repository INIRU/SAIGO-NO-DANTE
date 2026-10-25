'use client'

import { useState, type FormEvent } from 'react'
import { useSession } from 'next-auth/react'
import { useLocale } from 'next-intl'
import { Copy, Download, FileText, Layers, TriangleAlert } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { claimGuestPosts, useGuestPosts, type GuestPost } from '@/hooks/useGuestPosts'
import { getGuestCopy } from '@/lib/guest/copy'
import { isGuestKey, setGuestKey } from '@/lib/guest/key'
import { showError, showSuccess } from '@/lib/toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import RelativeTime from '@/components/ui/RelativeTime'
import Skeleton, { SkeletonLine } from '@/components/ui/Skeleton'
import '@/components/community/community.css'
import styles from '@/components/community/profile.module.css'

const input = 'min-h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[#17120c] px-3 text-[0.875rem] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--gold-dim)] aria-[invalid=true]:border-[#9b2c23]'

function PostSkeletonRows() {
  return (
    <ul className="grid gap-2">
      {[0, 1, 2].map(i => <li key={i}><Skeleton line className="h-12 rounded-lg" /></li>)}
    </ul>
  )
}

/** Same frame as the loaded page: key card on the left, deck and plan lists on the right. */
export function GuestSkeleton() {
  return (
    <div className={`${styles.page} ${styles.withNav}`} role="status" aria-busy="true">
      <div className={`${styles.rail} sticky-under-nav`}><Skeleton line className="h-[26rem] rounded-xl" /></div>
      <div className={styles.main}>
        {[0, 1].map(i => (
          <section key={i} className={styles.section}>
            <div className={styles.head}><SkeletonLine w="6rem" h="1.25rem" /></div>
            <PostSkeletonRows />
          </section>
        ))}
      </div>
    </div>
  )
}

function PostList({ title, posts, href, empty, icon: Icon }: { title: string; posts: GuestPost[]; href: (id: string) => string; empty: string; icon: typeof Layers }) {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}<span className={styles.titleCount}>{posts.length}</span></h2>
      </div>
      {posts.length ? (
        <ul className="grid gap-2">
          {posts.map(post => (
            <li key={post.id}>
              <Link href={href(post.id)} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[#2e2417] bg-[var(--bg-panel)] px-4 py-2.5 text-[var(--text-primary)] transition-colors duration-150 hover:border-[#5a4526] hover:bg-[#17120c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]">
                <span className="min-w-0 truncate text-[0.9375rem] font-semibold">{post.title}</span>
                <RelativeTime date={post.created_at} className="shrink-0 text-[0.8125rem] text-[#8a7d69]" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}><Icon aria-hidden="true" /><p>{empty}</p></div>
      )}
    </section>
  )
}

export default function GuestClient() {
  const t = getGuestCopy(useLocale())
  const { status } = useSession()
  const { key, keyRead, reloadKey, posts } = useGuestPosts()
  const [draft, setDraft] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [claiming, setClaiming] = useState(false)

  if (!keyRead) return <GuestSkeleton />

  const decks = posts.data?.decks ?? []
  const plans = posts.data?.plans ?? []
  const total = decks.length + plans.length

  const copyKey = () => {
    if (!key) return
    navigator.clipboard.writeText(key).then(() => showSuccess(t.copied), () => showError(t.copy))
  }
  const downloadKey = () => {
    if (!key) return
    const url = URL.createObjectURL(new Blob([key + '\n'], { type: 'text/plain' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'saigo-guest-key.txt' })
    a.click()
    URL.revokeObjectURL(url)
  }
  const applyKey = () => {
    setGuestKey(draft)
    setDraft('')
    setConfirmReplace(false)
    reloadKey()
    showSuccess(t.keyLoaded)
  }
  const submitKey = (event: FormEvent) => {
    event.preventDefault()
    const next = draft.trim()
    if (!isGuestKey(next)) { setInvalid(true); return }
    if (key && key !== next) setConfirmReplace(true)
    else applyKey()
  }
  const claim = async () => {
    if (!key) return
    setClaiming(true)
    try {
      const moved = await claimGuestPosts(key)
      reloadKey()
      showSuccess(t.claimed(moved.decks, moved.plans))
    } catch {
      showError(t.claimFailed)
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className={`${styles.page} ${styles.withNav}`}>
      <div className={`${styles.rail} sticky-under-nav`}>
        <div className={styles.card}>
          <h1 className={styles.name}>{t.title}</h1>

          <div className={styles.score}>
            <p className={styles.scoreLabel}>{t.key}</p>
            {key ? (
              <>
                <output className="mt-2 block break-all rounded-lg border border-[#241c14] bg-[#17120c] px-3 py-2.5 text-[0.875rem] leading-relaxed text-[var(--text-primary)]">{key}</output>
                <div className={styles.links}>
                  <button type="button" className={styles.ghost} onClick={copyKey}><Copy aria-hidden="true" />{t.copy}</button>
                  <button type="button" className={styles.ghost} onClick={downloadKey}><Download aria-hidden="true" />{t.download}</button>
                </div>
                <p className="mt-3 flex gap-2 text-[0.8125rem] leading-relaxed text-[var(--text-secondary)]">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" aria-hidden="true" />{t.warning}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[0.875rem] text-[#8a7d69]">{t.noKey}</p>
            )}
          </div>

          <form className={styles.score} onSubmit={submitKey}>
            <label htmlFor="guest-key" className={styles.scoreLabel}>{t.otherKey}</label>
            <div className="mt-2 flex gap-2">
              <input
                id="guest-key"
                value={draft}
                onChange={event => { setDraft(event.target.value); setInvalid(false) }}
                placeholder={t.keyPlaceholder}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalid}
                aria-describedby={invalid ? 'guest-key-error' : undefined}
                className={input}
              />
              <button type="submit" className={styles.ghost} disabled={!draft.trim()}>{t.load}</button>
            </div>
            {invalid && <p id="guest-key-error" role="alert" className="mt-1.5 text-[0.8125rem] text-[#e8a08a]">{t.invalidKey}</p>}
          </form>

          {key && total > 0 && (
            <div className={styles.score}>
              {status === 'authenticated' ? (
                <button type="button" className={`${styles.primary} w-full`} onClick={claim} disabled={claiming}>
                  {claiming ? t.claiming : t.claim}
                </button>
              ) : (
                <p className="flex flex-wrap items-center justify-between gap-2 text-[0.875rem] text-[var(--text-secondary)]">
                  {t.signInToClaim}
                  <Link href="/login" className={styles.ghost}>{t.login}</Link>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.main}>
        {posts.error ? (
          <div className={styles.empty} role="alert">
            <p>{t.loadError}</p>
            <button type="button" className={styles.ghost} onClick={() => void posts.mutate()}>{t.retry}</button>
          </div>
        ) : key && !posts.data ? (
          <div role="status" aria-busy="true">
            {[t.decks, t.plans].map(title => (
              <section key={title} className={styles.section}>
                <div className={styles.head}><h2 className={styles.title}>{title}</h2></div>
                <PostSkeletonRows />
              </section>
            ))}
          </div>
        ) : (
          <>
            <PostList title={t.decks} posts={decks} href={id => `/decks/${id}`} empty={t.noDecks} icon={Layers} />
            <PostList title={t.plans} posts={plans} href={id => `/planner/community/${id}`} empty={t.noPlans} icon={FileText} />
          </>
        )}
      </div>

      <ConfirmModal
        open={confirmReplace}
        title={t.replaceTitle}
        message={t.replaceMessage}
        confirmLabel={t.replace}
        cancelLabel={t.cancel}
        variant="warning"
        onConfirm={applyKey}
        onCancel={() => setConfirmReplace(false)}
      />
    </div>
  )
}

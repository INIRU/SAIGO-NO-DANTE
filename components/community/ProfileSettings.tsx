'use client'
import { useId, useState } from 'react'
import { useLocale } from 'next-intl'
import Switch from '@/components/ui/Switch'
import { getCommunityCopy } from '@/lib/community/copy'
import type { CommunitySettings } from '@/lib/community/rules'
import { showError } from '@/lib/toast'

type Key = keyof CommunitySettings
const GROUPS: { title: 'visibilityGroup' | 'notifications'; rows: { key: Key; label: 'visibility' | 'publicFollowing' | 'publicFollowers' | 'notifyComments' | 'notifyFollows' | 'notifyPosts' }[] }[] = [
  { title: 'visibilityGroup', rows: [{ key: 'public_profile', label: 'visibility' }, { key: 'public_following', label: 'publicFollowing' }, { key: 'public_followers', label: 'publicFollowers' }] },
  { title: 'notifications', rows: [{ key: 'notify_comments', label: 'notifyComments' }, { key: 'notify_follows', label: 'notifyFollows' }, { key: 'notify_posts', label: 'notifyPosts' }] },
]

/**
 * The owner's visibility and notification switches. A switch changes at once and is saved; if saving fails it flips
 * back and says so. The list switches wait while the whole profile is private.
 */
export default function ProfileSettings({ initial, onSaved }: { initial: CommunitySettings; onSaved: () => Promise<void> }) {
  const t = getCommunityCopy(useLocale())
  const id = useId()
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState<Key | null>(null)
  async function change(key: Key, value: boolean) {
    setValues(current => ({ ...current, [key]: value }))
    setSaving(key)
    try {
      const response = await fetch('/api/community/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: value }) })
      if (!response.ok) throw Error()
      await onSaved()
    } catch {
      setValues(current => ({ ...current, [key]: !value }))
      showError(t.saveError)
    } finally {
      setSaving(null)
    }
  }
  return (
    <div className="grid gap-4">
      {GROUPS.map(group => (
        <section key={group.title} aria-labelledby={`${id}-${group.title}`} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
          <h2 id={`${id}-${group.title}`} className="px-5 pb-2.5 pt-4 font-[family-name:var(--font-heading)] text-[0.9375rem] text-[var(--text-secondary)]">{t[group.title]}</h2>
          {group.rows.map(({ key, label }) => {
            const locked = (key === 'public_following' || key === 'public_followers') && !values.public_profile
            return (
              <label key={key} htmlFor={`${id}-${key}`}
                className={`flex min-h-14 items-center justify-between gap-4 border-t border-white/[0.05] px-5 transition-opacity duration-200 ${locked ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}>
                <span className="text-[0.9375rem] text-[var(--text-primary)]">{t[label]}</span>
                <Switch id={`${id}-${key}`} checked={values[key]} disabled={locked || saving === key} onChange={value => void change(key, value)} />
              </label>
            )
          })}
        </section>
      ))}
    </div>
  )
}

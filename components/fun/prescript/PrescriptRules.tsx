'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import styles from './prescript.module.css'

const SEEN_KEY = 'prescript-rules-seen'
const ARTICLES = ['rule_connect', 'rule_answer', 'rule_resist', 'rule_room', 'rule_penance', 'rule_judge', 'rule_break'] as const

/**
 * The terminal's rules (수칙), told once: open by itself on the first visit of this browser, and again from the hub. The
 * pages themselves then carry only short states (USER 2026-11-04: the explanation belongs at the start, not in every line).
 */
export default function PrescriptRules({ open: asked, onClose }: { open?: boolean; onClose?: () => void }) {
  const t = useTranslations('prescriptMode')
  const [first, setFirst] = useState(false)
  useEffect(() => { try { setFirst(window.localStorage.getItem(SEEN_KEY) !== '1') } catch { /* shown when asked */ } }, [])
  const open = asked || first
  const accept = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open) accept.current?.focus() }, [open])
  const close = () => {
    try { window.localStorage.setItem(SEEN_KEY, '1') } catch { /* asked again next time */ }
    setFirst(false)
    onClose?.()
  }
  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  })
  if (!open) return null
  return <div className={styles.rulesBack} role="presentation" onClick={close}>
    <section className={styles.rules} role="dialog" aria-modal="true" aria-labelledby="prescript-rules-title" onClick={event => event.stopPropagation()}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the game's prescript (terminal) keyword icon from public/ */}
      <img src="/assets/fun/prescript/prescript_terminal.png" alt="" width={40} height={40} />
      <h2 id="prescript-rules-title">{t('rulesTitle')}</h2>
      <ol>{ARTICLES.map((key, index) => <li key={key}><b>{t('ruleArticle', { n: index + 1 })}</b><span>{t(key)}</span></li>)}</ol>
      <button ref={accept} type="button" className={`${styles.b} ${styles.pri}`} onClick={close}>{t('rulesAccept')}</button>
    </section>
  </div>
}

'use client'

import { useId, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { LegalDoc } from '@/lib/data/legal'

type DocType = LegalDoc['type']
export type LoginConsentState = Partial<Record<DocType, boolean>>

/**
 * Required consent to each legal document, given only after its full text was opened and scrolled to the end.
 * One document is open at a time; its text scrolls inside the panel so the page itself never scrolls.
 */
export default function LoginConsent({ docs, agreed, onChange }: {
  docs: LegalDoc[]
  agreed: LoginConsentState
  onChange: (next: LoginConsentState) => void
}) {
  const t = useTranslations('loginPage')
  const id = useId()
  const [open, setOpen] = useState<DocType | null>(null)
  const [read, setRead] = useState<LoginConsentState>({})
  const markIfEnd = (type: DocType, box: HTMLElement | null) => {
    if (box && box.scrollTop + box.clientHeight >= box.scrollHeight - 8) setRead(current => current[type] ? current : { ...current, [type]: true })
  }
  return <ul className="login-consent-list">
    {docs.map(doc => {
      const panel = `${id}-${doc.type}`
      const isOpen = open === doc.type
      const canAgree = read[doc.type] === true
      return <li key={doc.type} className="login-consent-item" data-open={isOpen || undefined}>
        <div className="login-consent-row">
          <label className="login-consent-check" data-disabled={!canAgree || undefined}>
            <input type="checkbox" checked={agreed[doc.type] === true} disabled={!canAgree}
              onChange={event => onChange({ ...agreed, [doc.type]: event.target.checked })} />
            <span className="login-consent-box" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
            <span>{t(doc.type === 'terms' ? 'agreeTerms' : 'agreePrivacy')}</span>
          </label>
          <button type="button" className="login-consent-toggle" aria-expanded={isOpen} aria-controls={panel}
            onClick={() => setOpen(isOpen ? null : doc.type)}>
            {t(isOpen ? 'hideFull' : 'readFull')}<ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
        {isOpen && <div id={panel} className="login-consent-text" tabIndex={0} role="region" aria-label={doc.title}
          ref={box => markIfEnd(doc.type, box)} onScroll={event => markIfEnd(doc.type, event.currentTarget)}>
          <p className="login-consent-meta">{doc.title}{doc.version ? ` · ${doc.version}` : ''}</p>
          {doc.sections.map((section, index) => <section key={index}>
            <h3>{section.heading}</h3>
            {section.body && <p>{section.body}</p>}
            {section.items && <ul>{section.items.map((item, i) => <li key={i}>{item}</li>)}</ul>}
          </section>)}
        </div>}
        {!canAgree && <p className="login-consent-hint">{t('readToAgree')}</p>}
      </li>
    })}
  </ul>
}

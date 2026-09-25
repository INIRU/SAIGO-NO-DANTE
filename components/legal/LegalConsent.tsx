'use client'

import { useId, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { LegalDoc } from '@/lib/data/legal'
import './legal-consent.css'

type DocType = LegalDoc['type']
export type LegalConsentState = Partial<Record<DocType, boolean>>
export type LegalConsentLabels = { agreeTerms: string; agreePrivacy: string; readFull: string; hideFull: string; readToAgree: string }

/**
 * Required consent to each legal document, given only after its full text was opened and scrolled to the end.
 * One document is open at a time; its text scrolls inside the panel so the page itself never scrolls.
 * Labels are passed in because the legal update modal renders outside the next-intl provider.
 */
export default function LegalConsent({ docs, agreed, onChange, labels }: {
  docs: LegalDoc[]
  agreed: LegalConsentState
  onChange: (next: LegalConsentState) => void
  labels: LegalConsentLabels
}) {
  const t = (key: keyof LegalConsentLabels) => labels[key]
  const id = useId()
  const [open, setOpen] = useState<DocType | null>(null)
  const [read, setRead] = useState<LegalConsentState>({})
  const markIfEnd = (type: DocType, box: HTMLElement | null) => {
    if (box && box.scrollTop + box.clientHeight >= box.scrollHeight - 8) setRead(current => current[type] ? current : { ...current, [type]: true })
  }
  return <ul className="legal-consent-list">
    {docs.map(doc => {
      const panel = `${id}-${doc.type}`
      const isOpen = open === doc.type
      const canAgree = read[doc.type] === true
      return <li key={doc.type} className="legal-consent-item" data-open={isOpen || undefined}>
        <div className="legal-consent-row">
          <label className="legal-consent-check" data-disabled={!canAgree || undefined}>
            <input type="checkbox" checked={agreed[doc.type] === true} disabled={!canAgree}
              onChange={event => onChange({ ...agreed, [doc.type]: event.target.checked })} />
            <span className="legal-consent-box" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
            <span>{t(doc.type === 'terms' ? 'agreeTerms' : 'agreePrivacy')}</span>
          </label>
          <button type="button" className="legal-consent-toggle" aria-expanded={isOpen} aria-controls={panel}
            onClick={() => setOpen(isOpen ? null : doc.type)}>
            {t(isOpen ? 'hideFull' : 'readFull')}<ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
        {isOpen && <div id={panel} className="legal-consent-text" tabIndex={0} role="region" aria-label={doc.title}
          ref={box => markIfEnd(doc.type, box)} onScroll={event => markIfEnd(doc.type, event.currentTarget)}>
          <p className="legal-consent-meta">{doc.title}{doc.version ? ` · ${doc.version}` : ''}</p>
          {doc.sections.map((section, index) => <section key={index}>
            <h3>{section.heading}</h3>
            {section.body && <p>{section.body}</p>}
            {section.items && <ul>{section.items.map((item, i) => <li key={i}>{item}</li>)}</ul>}
          </section>)}
        </div>}
        {!canAgree && <p className="legal-consent-hint">{t('readToAgree')}</p>}
      </li>
    })}
  </ul>
}

'use client'

import { useId, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { LegalDoc } from '@/lib/data/legal'
import { emphasisParts } from '@/lib/legal-summary'
import './legal-consent.css'

type DocType = LegalDoc['type']
export type LegalConsentState = Partial<Record<DocType, boolean>>
export type LegalConsentLabels = { agreeAll: string; agreeTerms: string; agreePrivacy: string; readFull: string; hideFull: string }

function Emphasis({ text }: { text: string }) {
  return <>{emphasisParts(text).map((part, index) => part.strong ? <strong key={index}>{part.text}</strong> : part.text)}</>
}

/**
 * Required consent to each legal document. The points that matter are summarized above the boxes (the law asks for
 * the important terms to be made clear, not for the full text to be scrolled); the full text stays one tap away.
 * Labels are passed in because the legal update modal renders outside the next-intl provider.
 */
export default function LegalConsent({ docs, agreed, onChange, labels, summary }: {
  docs: LegalDoc[]
  agreed: LegalConsentState
  onChange: (next: LegalConsentState) => void
  labels: LegalConsentLabels
  summary?: { title: string; items: string[] }
}) {
  const id = useId()
  const [open, setOpen] = useState<DocType | null>(null)
  const all = docs.length > 0 && docs.every(doc => agreed[doc.type])
  return <div className="legal-consent">
    {summary && <section className="legal-summary" aria-labelledby={`${id}-summary`}>
      <h2 id={`${id}-summary`}>{summary.title}</h2>
      <ul>{summary.items.map((item, index) => <li key={index}><Emphasis text={item} /></li>)}</ul>
    </section>}
    {docs.length > 1 && <label className="legal-consent-check legal-consent-all">
      <input type="checkbox" checked={all} onChange={event => onChange(Object.fromEntries(docs.map(doc => [doc.type, event.target.checked])))} />
      <span className="legal-consent-box" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
      <span>{labels.agreeAll}</span>
    </label>}
    <ul className="legal-consent-list">
      {docs.map(doc => {
        const panel = `${id}-${doc.type}`
        const isOpen = open === doc.type
        return <li key={doc.type} className="legal-consent-item" data-open={isOpen || undefined}>
          <div className="legal-consent-row">
            <label className="legal-consent-check">
              <input type="checkbox" checked={agreed[doc.type] === true}
                onChange={event => onChange({ ...agreed, [doc.type]: event.target.checked })} />
              <span className="legal-consent-box" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
              <span>{labels[doc.type === 'terms' ? 'agreeTerms' : 'agreePrivacy']}</span>
            </label>
            <button type="button" className="legal-consent-toggle" aria-expanded={isOpen} aria-controls={panel}
              onClick={() => setOpen(isOpen ? null : doc.type)}>
              {labels[isOpen ? 'hideFull' : 'readFull']}<ChevronDown size={14} aria-hidden="true" />
            </button>
          </div>
          {isOpen && <div id={panel} className="legal-consent-text" tabIndex={0} role="region" aria-label={doc.title}>
            <p className="legal-consent-meta">{doc.title}{doc.version ? ` · ${doc.version}` : ''}</p>
            {doc.sections.map((section, index) => <section key={index}>
              <h3>{section.heading}</h3>
              {section.body && <p>{section.body}</p>}
              {section.items && <ul>{section.items.map((item, i) => <li key={i}>{item}</li>)}</ul>}
            </section>)}
          </div>}
        </li>
      })}
    </ul>
  </div>
}


'use client'

import type { InputHTMLAttributes } from 'react'
import { getGuestCopy } from '@/lib/guest/copy'
import { cleanGuestPin } from '@/lib/guest/key'

type Props = { value: string; onChange: (pin: string) => void; locale: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>

/**
 * Password field of a guest post (REQ-COMMUNITY-031): digits only, six at most. The digits stay readable, since nothing
 * asks the author to type them twice.
 */
export default function GuestPinInput({ value, onChange, locale, ...rest }: Props) {
  const t = getGuestCopy(locale)
  // No maxLength: it would cut a pasted value before the other characters are dropped.
  return <input value={value} onChange={event => onChange(cleanGuestPin(event.target.value))} inputMode="numeric" autoComplete="off"
    placeholder={t.pinPlaceholder} aria-label={t.pin} {...rest} />
}

'use client'

import { useState, type FormEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { KeyRound } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import { recoverGuestPost } from '@/features/account/hooks/useGuestPosts'
import { getGuestCopy, guestRecoverMessage } from '@/features/account/lib/guest-copy'
import { isGuestPin } from '@/features/account/lib/guest-key'
import { showError, showSuccess } from '@/lib/toast'
import GuestPinInput from './GuestPinInput'

/** "Edit with password" on a guest deck or plan this browser has no key for (REQ-COMMUNITY-031). */
export default function GuestPinRecover({ kind, id, onRecovered, className }: { kind: 'deck' | 'plan'; id: string; onRecovered: () => void; className?: string }) {
  const locale = useLocale(), t = getGuestCopy(locale), common = useTranslations('common')
  const [open, setOpen] = useState(false), [pin, setPin] = useState(''), [busy, setBusy] = useState(false)
  const close = () => { setOpen(false); setPin('') }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isGuestPin(pin) || busy) return
    setBusy(true)
    try { await recoverGuestPost({ kind, id }, pin); showSuccess(t.recovered); close(); onRecovered() }
    catch (error) { showError(guestRecoverMessage(error instanceof Error ? error.message : undefined, locale)) }
    finally { setBusy(false) }
  }
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)}>
      <KeyRound className="h-4 w-4" aria-hidden="true" />
      {t.recover}
    </button>
    <BaseModal open={open} onClose={close} title={t.recover} maxWidth="24rem">
      <form className="popup-confirm" onSubmit={submit}>
        <h2>{t.recover}</h2>
        <GuestPinInput value={pin} onChange={setPin} locale={locale}
          className="w-full rounded-md border border-[#5a4526] bg-[#070604] px-3 text-[1.0625rem] tracking-[0.2em] text-[var(--text-primary)] outline-none placeholder:tracking-normal placeholder:text-[var(--text-muted)]" />
        <div className="popup-actions">
          <button type="button" onClick={close}>{common('cancel')}</button>
          <button type="submit" className="popup-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={!isGuestPin(pin) || busy}>{common('confirm')}</button>
        </div>
      </form>
    </BaseModal>
  </>
}

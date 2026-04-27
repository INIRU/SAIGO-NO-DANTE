import { toast } from 'sonner'

const TOAST_DEDUPE_TTL_MS = 1800
const recentToasts = new Map<string, number>()

function dedupedToast(key: string, show: () => string | number) {
  const now = Date.now()
  const lastShownAt = recentToasts.get(key)
  if (lastShownAt && now - lastShownAt < TOAST_DEDUPE_TTL_MS) return null

  recentToasts.set(key, now)
  for (const [recentKey, shownAt] of recentToasts) {
    if (now - shownAt > TOAST_DEDUPE_TTL_MS) recentToasts.delete(recentKey)
  }

  return show()
}

/** 성공 토스트 */
export const showSuccess = (message: string) => dedupedToast(`success:${message}`, () => toast.success(message))

/** 에러 토스트 */
export const showError = (message: string) => dedupedToast(`error:${message}`, () => toast.error(message))

/** 경고 토스트 */
export const showWarning = (message: string) => dedupedToast(`warning:${message}`, () => toast.warning(message))

/** 복사 완료 토스트 */
export const showCopied = () => dedupedToast('success:copied', () => toast.success('클립보드에 복사되었습니다'))

/** 로딩 후 완료 패턴 */
export const showLoading = (message: string) => toast.loading(message)

export { toast }

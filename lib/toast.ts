import { toast } from 'sonner'

/** 성공 토스트 */
export const showSuccess = (message: string) => toast.success(message)

/** 에러 토스트 */
export const showError = (message: string) => toast.error(message)

/** 경고 토스트 */
export const showWarning = (message: string) => toast.warning(message)

/** 복사 완료 토스트 */
export const showCopied = () => toast.success('클립보드에 복사되었습니다')

/** 로딩 → 완료 패턴 */
export const showLoading = (message: string) => toast.loading(message)

export { toast }

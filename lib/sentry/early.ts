/** Errors kept before the browser Sentry starts: the SDK loads after the page (instrumentation-client.ts). */
const MAX_EARLY = 20

type Capture = (error: unknown) => void

export function createEarlyErrors() {
  const pending: unknown[] = []
  let capture: Capture | null = null
  const report = (error: unknown) => {
    if (capture) capture(error)
    else if (pending.length < MAX_EARLY) pending.push(error)
  }
  return {
    /** An error to send: kept until Sentry starts, then sent straight away (error pages call this). */
    report,
    /** Keeps uncaught errors and rejections until Sentry's own handlers take over; returns the stop. */
    listen(target: EventTarget) {
      const onError = (event: Event) => report((event as ErrorEvent).error ?? (event as ErrorEvent).message)
      const onRejection = (event: Event) => report((event as PromiseRejectionEvent).reason)
      target.addEventListener('error', onError)
      target.addEventListener('unhandledrejection', onRejection)
      return () => {
        target.removeEventListener('error', onError)
        target.removeEventListener('unhandledrejection', onRejection)
      }
    },
    /** Sentry started: send what was kept, once each, in order. */
    connect(next: Capture) {
      capture = next
      for (const error of pending.splice(0)) next(error)
    },
  }
}

/** The page's one keeper, shared by instrumentation-client.ts and the error pages. */
export const earlyErrors = createEarlyErrors()

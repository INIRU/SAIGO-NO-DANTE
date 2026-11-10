/** The game's long click is 1 s with a gauge that fills from the first frame; the site uses half of that (user asked: 1 s felt too slow). */
export const LONG_PRESS_MS = 500

/**
 * One press timer: start on pointer down, cancel on up / leave / cancel / drag, and let the click handler drop the
 * click that ends a press that already fired.
 */
export function createLongPress<T = void>(fire: (arg: T) => void, ms = LONG_PRESS_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let fired = false
  return {
    start(arg: T) {
      clearTimeout(timer)
      fired = false
      timer = setTimeout(() => { fired = true; fire(arg) }, ms)
    },
    cancel() { clearTimeout(timer) },
    /** True once after a fired press: the click that follows it must do nothing. */
    consume() { const was = fired; fired = false; return was },
  }
}

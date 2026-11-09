/**
 * Bars that stick under the navbar (`.sticky-under-nav`, app/globals.css) stand at the navbar's constant height and slide up
 * with it (a transform) while they are stuck and the navbar hides. Animating their `top` instead laid the page out every frame
 * and stuttered on phones. Only a stuck bar slides: one still in the page's flow would slide over the content above it.
 */

/** Whether a bar rests at its sticky top: its place on screen without the slide it may be in. */
export function isStuck(rectTop: number, translateY: number, stickyTop: number) {
  return rectTop - translateY <= stickyTop + 0.5
}

/** Marks each sticky bar `data-stuck` while it is stuck: all reads first, then the writes, so one frame lays out once. */
export function markStuckBars() {
  const bars = [...document.querySelectorAll<HTMLElement>('.sticky-under-nav')]
  const stuck = bars.map(bar => {
    const style = getComputedStyle(bar)
    if (style.position !== 'sticky') return false
    const slide = style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m42
    return isStuck(bar.getBoundingClientRect().top, slide, parseFloat(style.top) || 0)
  })
  bars.forEach((bar, i) => bar.toggleAttribute('data-stuck', stuck[i]))
}

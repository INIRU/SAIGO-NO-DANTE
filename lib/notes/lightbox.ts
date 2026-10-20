type Box = { left: number; top: number; width: number; height: number }

/**
 * The CSS transform that makes the large picture (`target`, where it ends up) sit exactly on the small one (`from`, the
 * picture that was pressed); animating from it to `none` grows the picture out of its place. Null while either has no size.
 */
export function lightboxStartTransform(from: Box, target: Box): string | null {
  if (!from.width || !from.height || !target.width || !target.height) return null
  const dx = from.left + from.width / 2 - (target.left + target.width / 2)
  const dy = from.top + from.height / 2 - (target.top + target.height / 2)
  return `translate(${dx}px, ${dy}px) scale(${from.width / target.width}, ${from.height / target.height})`
}

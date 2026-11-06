import type { ReactNode, SVGProps } from 'react'

export type IconProps = { size?: number | string } & SVGProps<SVGSVGElement>

/**
 * The site's icon frame. The game's own icons (LowerControl, Common/icon_*) are heavy, sharp and built on the clash
 * coin's octagon, so every glyph here is a 24-grid line drawing at weight 2 with flat ends and mitred corners;
 * boxes lose their corners to the octagon instead of rounding them. Colour is always the text colour.
 */
export function Svg({ size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="butt" strokeLinejoin="miter" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  )
}

const n = (v: number) => +v.toFixed(2)

/** A box with its four corners cut at 45°: the coin's octagon stretched to `w`×`h`. */
export function cut(x: number, y: number, w: number, h: number, c: number) {
  return `M${n(x + c)} ${n(y)}H${n(x + w - c)}L${n(x + w)} ${n(y + c)}V${n(y + h - c)}L${n(x + w - c)} ${n(y + h)}H${n(x + c)}L${n(x)} ${n(y + h - c)}V${n(y + c)}Z`
}

/** Dante's clock star, the four-point mark at twelve o'clock on the logo. */
export function star(cx: number, cy: number, r: number) {
  const k = r * 0.28
  return `M${n(cx)} ${n(cy - r)}L${n(cx + k)} ${n(cy - k)}L${n(cx + r)} ${n(cy)}L${n(cx + k)} ${n(cy + k)}L${n(cx)} ${n(cy + r)}L${n(cx - k)} ${n(cy + k)}L${n(cx - r)} ${n(cy)}L${n(cx - k)} ${n(cy - k)}Z`
}

/** The game's checkbox: a square turned 45°. */
export function diamond(cx: number, cy: number, r: number) {
  return `M${n(cx)} ${n(cy - r)}L${n(cx + r)} ${n(cy)}L${n(cx)} ${n(cy + r)}L${n(cx - r)} ${n(cy)}Z`
}

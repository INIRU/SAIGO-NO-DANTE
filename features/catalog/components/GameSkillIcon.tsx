import type { CSSProperties } from 'react'
import Image from 'next/image'
import { getSkillFrameAssetUrl } from '@/lib/utils/images'

const SINS = new Set(['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'])

// The game's skill icon (UnitInfoSkillSlot > SkillIconWithText, 250 x 217.6 UI units), from the skill frame guide's layout.
// The box is widened 16 left (base power) and 12 up (coin plate) so nothing spills out: 266 x 230 units.
// Without the power numbers (a bare icon) the box is just the 210-unit frame and the glow spills a little past it.
const W = 266
const OX = 16
const OY = 12
const unitsOf = (width: number) => {
  const u = (n: number) => `${(n * 100) / width}cqw`
  // maxWidth: the base styles cap images at their parent's width; the attack glow is larger than its badge
  const box = (x: number, y: number, w: number, h: number): CSSProperties =>
    ({ position: 'absolute', left: u(x), top: u(y), width: u(w), height: u(h), maxWidth: 'none' })
  return { u, box }
}
const layer: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

/** A game sprite filling its positioned box. The Storage sprites are already small sized WebP, so they skip the optimizer. */
function Sprite({ name, fit = 'fill', loading }: { name: string; fit?: 'fill' | 'contain'; loading?: 'eager' }) {
  return <Image src={getSkillFrameAssetUrl(name)} alt="" fill unoptimized sizes="10rem" loading={loading} style={{ objectFit: fit }} />
}
const number = (size: string, color: string): CSSProperties => ({
  ...layer, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', lineHeight: 1,
  fontFamily: 'var(--font-excelsior), sans-serif', fontSize: size, color,
  WebkitTextStroke: '0.046em #000', paintOrder: 'stroke fill',
})

export interface GameSkillIconProps {
  /** The skill's own art (masked into the frame) */
  iconUrl: string
  /** wrath … envy; anything else draws the neutral frame */
  sin?: string | null
  /** Skill tier 1-3 (an E.G.O skill's 99 draws tier 3) */
  tier?: number | null
  /** slash / pierce / blunt; null for a guard or evade (no badge) */
  attackType?: 'slash' | 'pierce' | 'blunt' | null
  /** With both powers left out the icon is drawn bare: the frame alone, filling `size` */
  basePower?: number
  coinPower?: number
  /** The skill art failed to load (the caller may swap in another) */
  onIconError?: () => void
  eager?: boolean
  /** The sin-coloured glow behind the frame and the attack badge. Off for small icons in a row, where the glows run into each other. */
  glow?: boolean
  /** Width of the whole icon (CSS length) */
  size?: string
  className?: string
}

export default function GameSkillIcon({ iconUrl, sin, tier, attackType, basePower, coinPower, size = '9rem', className, onIconError, eager, glow = true }: GameSkillIconProps) {
  const s = sin && SINS.has(sin) ? sin : 'neutral'
  const t = Math.min(3, Math.max(1, Math.trunc(tier || 1)))
  const mask = `url(${getSkillFrameAssetUrl('mask')})`
  const bare = basePower == null || coinPower == null
  const { u, box } = unitsOf(bare ? 210 : W)
  const loading = eager ? 'eager' : undefined
  const frame = (
    <>
      {/* glow (on by default on the site), the icon cut by the heptagon mask, the frame */}
      {glow && <div style={box(-3.2, 0.6, 210, 210)}><Sprite name={`${s}-${t}-glow`} loading={loading} /></div>}
      <div style={{ ...box(-7, -7, 224, 224), background: '#000', maskImage: mask, WebkitMaskImage: mask, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }}>
        <div style={box(62, 62, 100, 100)}><Image src={iconUrl} alt="" fill sizes="5rem" loading={loading} onError={onIconError} style={{ objectFit: 'cover' }} /></div>
      </div>
      <div style={layer}><Sprite name={`${s}-${t}`} loading={loading} /></div>
      {attackType && (
        <div style={box(73.2, 136.9, 52, 52)}>
          {glow && <div style={box(-64, -64, 180, 180)}><Sprite name={`${s}-attack-glow`} fit="contain" loading={loading} /></div>}
          <div style={layer}><Sprite name={`${s}-${attackType}`} loading={loading} /></div>
        </div>
      )}
    </>
  )
  if (bare) {
    return (
      <div className={className} style={{ position: 'relative', width: size, aspectRatio: '1', containerType: 'inline-size', flexShrink: 0 }} aria-hidden>
        {frame}
      </div>
    )
  }
  const coin = coinPower < 0 ? `-${Math.abs(coinPower)}` : `+${coinPower}`
  const power = String(basePower)

  return (
    <div className={className} style={{ position: 'relative', width: size, aspectRatio: `${W} / 230`, containerType: 'inline-size', flexShrink: 0 }} aria-hidden>
      {/* coin power plate, flipped and sin coloured */}
      <div style={box(OX + 77.761, OY - 9.805, 83.403, 68.47)}>
        <Sprite name={`${s}-coin`} fit="contain" />
      </div>
      <div style={box(OX + 20, OY - 0.885, 210, 210)}>
        {frame}
      </div>
      <div style={box(OX + 68.3, OY - 4.185, 100, 50)}>
        <span style={{ ...number(u(50), 'rgb(232,184,127)'), justifyContent: 'center', letterSpacing: '-0.06em' }}>{coin}</span>
      </div>
      <div style={box(OX - 14.21, OY + 69.115, 63.21, 50)}>
        <span style={{ ...number(u(power.length > 2 ? 56 : 80), 'rgb(233,184,128)'), justifyContent: 'flex-end' }}>{power}</span>
      </div>
    </div>
  )
}

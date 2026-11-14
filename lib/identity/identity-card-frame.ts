import type { CSSProperties } from 'react'

/*
 * In-game formation card frame geometry. All 12 frames are crops of one sprite sheet at the same pixel scale;
 * their decorations (uptie II chains, III thorns, IV knots) stick out by different amounts. The card box is the
 * frame's outer border line (290×428, measured from the alpha channel), and each crop is placed so its border
 * line is centred on that box. [image width, image height, border x, border y]
 * Same numbers as FramedIdentity in features/decks/components/PlannerDeckSelection.tsx.
 */
const IDENTITY_CARD_FRAMES: Record<number, Record<number, [number, number, number, number]>> = {
  1: { 1: [304, 442, 7, 7], 2: [328, 484, 15, 41], 3: [323, 458, 15, 15], 4: [320, 458, 14.5, 15] },
  2: { 1: [304, 442, 7, 6.5], 2: [323, 486, 10, 44.5], 3: [324, 455, 14, 17], 4: [320, 458, 15, 15] },
  3: { 1: [305, 443, 7, 8], 2: [322, 481, 10, 45], 3: [331, 462, 18, 20], 4: [320, 458, 15, 15] },
}
const IDENTITY_CARD_W = 290
const IDENTITY_CARD_H = 428

const pct = (value: number, of: number) => (value / of * 100).toFixed(3) + '%'

export function identityCardFrame(rarity: number, uptie: number) {
  const rank = IDENTITY_CARD_FRAMES[rarity] ? rarity : 1
  const stage = IDENTITY_CARD_FRAMES[rank][uptie] ? uptie : 4
  const [width, height, x, y] = IDENTITY_CARD_FRAMES[rank][stage]
  const box: CSSProperties = { left: pct(-x, IDENTITY_CARD_W), top: pct(-y, IDENTITY_CARD_H), width: pct(width, IDENTITY_CARD_W), height: pct(height, IDENTITY_CARD_H) }
  return { rarity: rank, uptie: stage, width, height, box }
}

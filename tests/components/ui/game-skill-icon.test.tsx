import { describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
import { renderToStaticMarkup } from 'react-dom/server'
import GameSkillIcon from '@/components/ui/GameSkillIcon'
import { STORAGE_BASE } from '@/lib/constants/game'

const asset = (name: string) => `${STORAGE_BASE}/ui/skill-frame/${name}.webp`

function icon(props: Partial<Parameters<typeof GameSkillIcon>[0]> = {}) {
  return renderToStaticMarkup(
    <GameSkillIcon iconUrl="https://example.test/skill.webp" sin="pride" tier={3} attackType="pierce" basePower={6} coinPower={4} {...props} />,
  )
}

describe('game skill icon', () => {
  it('draws the sin-coloured frame, glow and coin plate of the skill tier', () => {
    const html = icon()
    expect(html).toContain(asset('pride-3'))
    expect(html).toContain(asset('pride-3-glow'))
    expect(html).toContain(asset('pride-coin'))
    expect(html).toContain('https://example.test/skill.webp')
  })

  it('shows the base power and the coin power with its sign', () => {
    const html = icon({ basePower: 16, coinPower: -2 })
    expect(html).toMatch(/>16</)
    expect(html).toMatch(/>-2</)
    expect(icon()).toMatch(/>\+4</)
  })

  it('puts the attack type badge and its glow on attack skills only', () => {
    expect(icon()).toContain(asset('pride-pierce'))
    expect(icon()).toContain(asset('pride-attack-glow'))
    const evade = icon({ attackType: null, tier: 1, sin: 'sloth' })
    expect(evade).toContain(asset('sloth-1'))
    expect(evade).not.toContain('sloth-attack-glow')
    expect(evade).not.toMatch(/sloth-(slash|pierce|blunt)/)
  })

  it('draws an unknown sin with the neutral frame and an E.G.O tier with the tier 3 frame', () => {
    expect(icon({ sin: 'unknown', tier: 99 })).toContain(asset('neutral-3'))
  })
})

describe('game skill name plate and level icon', () => {
  it('puts the name on the sin-coloured game plate', async () => {
    const { default: GameSkillName } = await import('@/features/catalog/components/GameSkillName')
    const html = renderToStaticMarkup(<GameSkillName name="피를 머금은 향기" sin="pride" />)
    expect(html).toContain(asset('pride-name'))
    expect(html).toContain('피를 머금은 향기')
    expect(renderToStaticMarkup(<GameSkillName name="x" sin={null} />)).toContain(asset('neutral-name'))
  })

  it('picks the level icon by defence type: sword for attack and counter, arrow shield for evade and guard', async () => {
    const { skillLevelIconUrl } = await import('@/features/catalog/components/GameSkillName')
    expect(skillLevelIconUrl('pierce')).toBe(asset('level-attack'))
    expect(skillLevelIconUrl('counter')).toBe(asset('level-attack'))
    expect(skillLevelIconUrl('evade')).toBe(asset('level-counter'))
    expect(skillLevelIconUrl('defense')).toBe(asset('level-counter'))
    expect(skillLevelIconUrl('guard')).toBe(asset('level-counter'))
    expect(skillLevelIconUrl('unknown')).toBe(asset('level-defense'))
  })
})

describe('game skill box', () => {
  const base = {
    iconUrl: 'https://example.test/skill.webp', sin: 'gloom', tier: 3, attackType: 'slash' as const, basePower: 4, coinPower: 3,
    name: '날 세워 칼을 웃거라, 낙엽 향 나듯 폭포를 울거라', skillType: 'slash', level: 69, weight: 2,
    weightLabel: '공격 가중치', coins: [{}, {}, {}, { unbreakable: true }],
  }
  it('lays the skill out like the game skill box: coins, the whole name on one line, level and weight', async () => {
    const { default: GameSkillBox } = await import('@/features/catalog/components/GameSkillBox')
    const html = renderToStaticMarkup(<GameSkillBox {...base} />)
    expect(html).toContain(base.name)
    expect(html).not.toContain('truncate')
    expect(html).toContain('white-space:nowrap')
    expect(html.match(/<img[^>]*coin-gold\.webp/g)).toHaveLength(3)
    expect(html).toContain('coins/unbreakable')
    expect(html).toMatch(/>69</)
    // the level is coloured only by an effect's change (none in the catalog): the unchanged colour
    expect(html).toMatch(/color:rgb\(235,202,162\)[^>]*>69/)
    expect(html).toContain(asset('level-attack'))
    expect(html.match(/<img[^>]*target-num\.webp/g)).toHaveLength(2)
    expect(html).toContain('공격 가중치')
  })

  it('writes the skill tier under the icon only when given (a base skill 1-3)', async () => {
    const { default: GameSkillBox } = await import('@/features/catalog/components/GameSkillBox')
    expect(renderToStaticMarkup(<GameSkillBox {...base} tierLabel="SKILL 3" />)).toMatch(/rgb\(161,106,59\)[^>]*>SKILL 3</)
    expect(renderToStaticMarkup(<GameSkillBox {...base} />)).not.toContain('SKILL')
  })

  it('colours an effect-lowered attack level red and a coin by its game colour', async () => {
    const { default: GameSkillBox } = await import('@/features/catalog/components/GameSkillBox')
    const html = renderToStaticMarkup(<GameSkillBox {...base} levelChange={-1} coins={[{ color: 'PURPLE' }]} skillType="evade" attackType={null} />)
    expect(html).toContain('rgb(153,0,0)')
    expect(html).toContain('coin-purple.webp')
    expect(html).toContain(asset('level-counter'))
  })
})

describe('bare skill icon', () => {
  it('draws the frame alone when no power is given, and the small skill frame uses it', async () => {
    const bare = renderToStaticMarkup(<GameSkillIcon iconUrl="https://example.test/skill.webp" sin="wrath" tier={2} attackType="blunt" />)
    expect(bare).toContain(asset('wrath-2'))
    expect(bare).toContain(asset('wrath-blunt'))
    expect(bare).not.toContain(asset('wrath-coin'))
    const { default: SkillFrame } = await import('@/features/catalog/components/SkillFrame')
    const html = renderToStaticMarkup(<SkillFrame skillIconUrl="https://example.test/skill.webp" sin="lust" skillSlot={4} sinColor="#f80" label="S4" />)
    expect(html).toContain(asset('lust-1'))
    expect(html).not.toContain('/assets/skill-frames/')
  })
})

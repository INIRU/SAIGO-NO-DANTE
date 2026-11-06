import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Identity } from '@/lib/types'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => Object.assign((key: string) => key, { raw: () => ({}) }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

import IdentityCard from '@/features/catalog/components/IdentityCard'
import { MAX_IDENTITY_LEVEL } from '@/features/catalog/lib/identity-level'

// 20구 유로지비: stored at level 60 as HP 214 and defense 60.
const identity = {
  id: 'i1', sinner_id: 'yi-sang', name_kr: '20구 유로지비', rarity: 3, tier: 3, hp: 214, base_hp: 70, hp_per_level: 2.4,
  speed_min: 3, speed_max: 7, def_level: 60, keywords: [], game_id: '10101', folder_name: 'x',
} as unknown as Identity

describe('identity stats follow the level cap', () => {
  it('shows the list card at the maximum level, not the stored level 60', () => {
    expect(MAX_IDENTITY_LEVEL).toBe(65)
    const html = renderToStaticMarkup(<IdentityCard identity={identity} />)
    expect(html).toContain('<dd>226</dd>')
    expect(html).toContain('<dd>65</dd>')
    expect(html).not.toContain('<dd>214</dd>')
  })

  it.each(['lib/db/queries.ts', 'app/[lang]/sinners/[slug]/page.tsx', 'app/[lang]/decks/[id]/page.tsx', 'app/[lang]/planner/community/[id]/page.tsx'])('%s reads what the HP of a level needs', file => {
    expect(readFileSync(file, 'utf8')).toContain('base_hp, hp_per_level')
  })
})

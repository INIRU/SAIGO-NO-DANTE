import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ fail: false, skill: null as unknown }))
vi.mock('@/lib/motion/feed', async () => ({
  loadMotionSiteData: async (lang: string) => { if (state.fail) throw new Error('down'); return { identities: [], skillNames: [[1, lang]], skillFrames: [], refs: null } },
  loadMotionSkill: async (id: number) => { if (state.fail) throw new Error('down'); return id === 1021601 ? state.skill : null },
  pickMotionSkillRow: (await vi.importActual<typeof import('@/lib/motion/feed')>('@/lib/motion/feed')).pickMotionSkillRow,
}))

import { GET as siteData } from '@/app/api/motion/site-data/route'
import { GET as skill } from '@/app/api/motion/skill/route'
import { pickMotionSkillRow } from '@/lib/motion/feed'

beforeEach(() => { state.fail = false; state.skill = { id: 's1', name: '여명의 섬광', coins: 2 } })

it('REQ-MOTION-004 serves the site\'s names for the motion list in the asked language, cached publicly, and 503 when the database is down', async () => {
  const res = await siteData(new Request('http://localhost/api/motion/site-data?lang=en'))
  expect(await res.json()).toEqual({ identities: [], skillNames: [[1, 'en']], skillFrames: [], refs: null })
  expect(res.headers.get('cache-control')).toContain('public')
  expect((await (await siteData(new Request('http://localhost/api/motion/site-data?lang=xx'))).json()).skillNames[0][1]).toBe('ko')
  state.fail = true
  expect((await siteData(new Request('http://localhost/api/motion/site-data'))).status).toBe(503)
})

it('REQ-MOTION-005 returns the site\'s skill for a game skill id, 404 for one it does not have and 400 for a bad id', async () => {
  const res = await skill(new Request('http://localhost/api/motion/skill?id=1021601&lang=ko'))
  expect(await res.json()).toEqual({ skill: { id: 's1', name: '여명의 섬광', coins: 2 } })
  expect((await skill(new Request('http://localhost/api/motion/skill?id=9999999'))).status).toBe(404)
  expect((await skill(new Request('http://localhost/api/motion/skill?id=abc'))).status).toBe(400)
  state.fail = true
  expect((await skill(new Request('http://localhost/api/motion/skill?id=1021601'))).status).toBe(503)
})

it('REQ-MOTION-005 shows the highest uptie of a skill, then its first variant', () => {
  expect(pickMotionSkillRow([
    { id: 'a', uptie_level: 3, variant_order: 1 }, { id: 'b', uptie_level: 4, variant_order: 2 }, { id: 'c', uptie_level: 4, variant_order: 1 },
  ])?.id).toBe('c')
  expect(pickMotionSkillRow([])).toBeNull()
})

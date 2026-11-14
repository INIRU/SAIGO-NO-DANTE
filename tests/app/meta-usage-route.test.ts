import { beforeEach, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/meta/usage/route'
import { getMetaData } from '@/features/meta/server'

vi.mock('@/features/meta/server', () => ({ getMetaData: vi.fn(async () => ({ sampleCount: 0 })) }))

const get = (query: string) => GET(new Request('http://localhost/api/meta/usage?' + query))

beforeEach(() => { vi.mocked(getMetaData).mockClear() })

it('refuses a filter value, mode, source or period that is not on its list', async () => {
  for (const query of ['usage=raid', 'keyword=' + encodeURIComponent('참격'), 'difficulty=nightmare', 'sinner=nobody', 'rarity=4', 'keywordMode=xor', 'usage=story,raid', 'source=posts', 'period=1']) {
    expect((await get(query)).status, query).toBe(400)
  }
  expect(getMetaData).not.toHaveBeenCalled()
})

it('hands known filters on in one order, whatever order they were sent in', async () => {
  expect((await get('source=planner&period=month&keyword=' + encodeURIComponent('진동,화상') + '&keywordMode=or&sinner=faust,yi-sang')).status).toBe(200)
  expect(getMetaData).toHaveBeenCalledWith('planner', 'month', { keyword: ['화상', '진동'], sinner: ['yi-sang', 'faust'], keywordMode: 'or' })
  await get('')
  expect(getMetaData).toHaveBeenLastCalledWith('all', 'all', {})
})

it('reads the old day-count periods as update-week periods', async () => {
  expect((await get('period=7')).status).toBe(200)
  expect(getMetaData).toHaveBeenLastCalledWith('all', 'week', {})
  expect((await get('period=90')).status).toBe(200)
  expect(getMetaData).toHaveBeenLastCalledWith('all', 'month', {})
})

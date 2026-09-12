import { expect, it } from 'vitest'
import { gameDataPaths } from './source-paths'

it('keeps every locale inside an explicitly selected recovery source', () => {
  expect(gameDataPaths('/tmp/recovery/Json (Text)')).toEqual({
    data: '/tmp/recovery/Json (Text)',
    kr: '/tmp/recovery/Json (Text)/KR', en: '/tmp/recovery/Json (Text)/EN', jp: '/tmp/recovery/Json (Text)/JP',
    krLatest: '/tmp/recovery/Json (Text)/KR', enLatest: '/tmp/recovery/Json (Text)/EN', jpLatest: '/tmp/recovery/Json (Text)/JP',
  })
})

import { describe, expect, it } from 'vitest'
import { parseNews } from '@/features/news/lib/payload'

const base = {
  id: 'steam:5124582150142200443',
  feed: 'limbus',
  platform: 'steam',
  published_at: '2026-10-06T18:00:00+09:00',
  content: { ko: { title: '정기 점검 안내' } },
}
const issuesOf = (body: unknown) => {
  const result = parseNews(body)
  return result.ok ? [] : result.issues.map(issue => issue.path)
}

describe('news payload', () => {
  it('accepts the smallest item and fills the defaults', () => {
    const result = parseNews(base)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ category: 'notice', spoiler: false, starts_at: null, ends_at: null, author: null })
    expect(result.value.content.ko).toEqual({ title: '정기 점검 안내', body: '', url: null, media: [], translated: false })
  })

  it('takes all three languages, an author and a period in one request', () => {
    const result = parseNews({
      ...base, category: 'live', spoiler: true, starts_at: '2026-10-06T10:00:00Z', ends_at: '2026-10-06T12:00:00Z',
      author: { name: '햄햄팡팡', handle: 'Ham_PangPang' },
      content: {
        ko: { title: '가', body: '본문\n둘째 줄', url: 'https://x.com/a/status/1' },
        en: { title: 'A', translated: true },
        ja: { title: 'あ' },
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.value.content)).toEqual(['ko', 'en', 'ja'])
    expect(result.value.content.en?.translated).toBe(true)
    expect(result.value.author).toEqual({ name: '햄햄팡팡', handle: 'Ham_PangPang', url: null })
  })

  it('names every field that is wrong', () => {
    expect(issuesOf({})).toEqual(expect.arrayContaining(['id', 'feed', 'platform', 'published_at', 'content']))
    expect(issuesOf({ ...base, content: {} })).toEqual(['content'])
    expect(issuesOf({ ...base, content: { jp: { title: 'あ' } } })).toContain('content')
    expect(issuesOf({ ...base, id: 'x'.repeat(121) })).toEqual(['id'])
    expect(issuesOf({ ...base, feed: 'steam' })).toEqual(['feed'])
    expect(issuesOf({ ...base, published_at: '2026-10-06 18:00' })).toEqual(['published_at'])
    expect(issuesOf({ ...base, content: { ko: { title: '' } } })).toEqual(['content.ko.title'])
    expect(issuesOf({ ...base, content: { ko: { title: '가', body: '가'.repeat(4001) } } })).toEqual(['content.ko.body'])
    expect(issuesOf({ ...base, starts_at: '2026-10-07T00:00:00Z', ends_at: '2026-10-06T00:00:00Z' })).toEqual(['ends_at'])
    expect(issuesOf({ ...base, source: 'steam' })).toEqual([''])
    const failed = parseNews({ ...base, feed: 'steam' })
    expect(!failed.ok && failed.issues[0].message).toBeTruthy()
  })

  it('takes media only from the allowed hosts over https', () => {
    const media = (items: unknown[]) => ({ ...base, content: { ko: { title: '가', media: items } } })
    const ok = parseNews(media([
      { type: 'image', url: 'https://clan.fastly.steamstatic.com/images/1/a.png' },
      { type: 'image', url: 'https://pbs.twimg.com/media/a.jpg' },
      { type: 'youtube', id: 'dQw4w9WgXcQ' },
      { type: 'video', url: 'https://x.com/a/status/1/video/1', thumbnail: 'https://i.ytimg.com/vi/a/hq.jpg' },
      { type: 'video', url: 'https://chzzk.naver.com/live/1' },
    ]))
    expect(ok.ok).toBe(true)
    expect(issuesOf(media([{ type: 'image', url: 'https://evil.example/a.png' }]))).toEqual(['content.ko.media.0.url'])
    expect(issuesOf(media([{ type: 'image', url: 'https://steamstatic.com.evil.example/a.png' }]))).toEqual(['content.ko.media.0.url'])
    expect(issuesOf(media([{ type: 'image', url: 'http://pbs.twimg.com/media/a.jpg' }]))).toEqual(['content.ko.media.0.url'])
    expect(issuesOf(media([{ type: 'youtube', id: 'https://youtu.be/dQw4w9WgXcQ' }]))).toEqual(['content.ko.media.0.id'])
    expect(issuesOf(media([{ type: 'video', url: 'https://x.com/a', thumbnail: 'https://evil.example/a.png' }]))).toEqual(['content.ko.media.0.thumbnail'])
    expect(issuesOf(media([{ type: 'video', url: 'javascript:alert(1)' }]))).toEqual(['content.ko.media.0.url'])
    expect(issuesOf(media(Array.from({ length: 11 }, () => ({ type: 'youtube', id: 'dQw4w9WgXcQ' }))))).toEqual(['content.ko.media'])
    expect(issuesOf({ ...base, content: { ko: { title: '가', url: 'javascript:alert(1)' } } })).toEqual(['content.ko.url'])
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.hoisted(() => ({ sent: [] as { endpoint: string; payload: Record<string, string> }[], fail: new Map<string, number>() }))
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (subscription: { endpoint: string }, payload: string) => {
      const code = push.fail.get(subscription.endpoint)
      if (code) throw Object.assign(new Error('gone'), { statusCode: code })
      push.sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) })
    }),
  },
}))

import { pushSubscriptionSchema, urlBase64ToUint8Array } from '@/lib/push/keys'
import { pushMessage, shouldPushPost } from '@/lib/push/message'
import { sendPushes, type PushNote } from '@/lib/push/send'

const source = (path: string) => readFileSync(resolve(__dirname, '../../..', path), 'utf8')

describe('push message', () => {
  it('REQ-COMMUNITY-095 says what the bell says, in the subscription\'s language, and links to the place', () => {
    const comment: PushNote = { to: 'u1', kind: 'comment', actor: '돈키', target: 'deck', targetId: 'd1', title: '화상 덱', excerpt: '잘 봤어요' }
    expect(pushMessage(comment, 'ko')).toEqual({ title: '돈키님이 화상 덱에 댓글을 남겼어요', body: '잘 봤어요', url: '/ko/decks/d1#deck-comments-title', tag: 'comment:d1' })
    expect(pushMessage({ to: 'u1', kind: 'follow', actor: 'Faust', target: 'user', targetId: 'u9' }, 'en'))
      .toMatchObject({ title: 'Faust started following you', body: '', url: '/en/users/u9' })
    expect(pushMessage({ to: 'u1', kind: 'post', actor: null, target: 'plan', targetId: 'p1', title: '15층 플랜' }, 'ko'))
      .toMatchObject({ title: '익명님이 새 글을 올렸어요', body: '15층 플랜', url: '/ko/planner/community/p1' })
  })

  it('REQ-COMMUNITY-095 pushes an author\'s new posts at most once an hour', () => {
    const seen = new Map<string, number>()
    expect(shouldPushPost(seen, 'a', 0)).toBe(true)
    expect(shouldPushPost(seen, 'a', 59 * 60_000)).toBe(false)
    expect(shouldPushPost(seen, 'b', 59 * 60_000)).toBe(true)
    expect(shouldPushPost(seen, 'a', 61 * 60_000)).toBe(true)
  })
})

describe('push subscription', () => {
  it('REQ-COMMUNITY-094 accepts a browser subscription with its language and nothing loose', () => {
    const keys = { p256dh: 'BOr3k_-x', auth: 'aB_-9' }
    expect(pushSubscriptionSchema.safeParse({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys, lang: 'ja' }).success).toBe(true)
    for (const bad of [
      { endpoint: 'http://fcm.googleapis.com/x', keys, lang: 'ko' },
      { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'a b', auth: 'c' }, lang: 'ko' },
      { endpoint: 'https://fcm.googleapis.com/x', keys, lang: 'fr' },
    ]) expect(pushSubscriptionSchema.safeParse(bad).success).toBe(false)
  })

  it('REQ-COMMUNITY-094 turns the server\'s base64url key into bytes', () => {
    expect([...urlBase64ToUint8Array('AQID')]).toEqual([1, 2, 3])
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255])
  })
})

describe('push sending', () => {
  const subs = [
    { endpoint: 'https://push.example/1', p256dh: 'k', auth: 'a', lang: 'ko', user_id: 'u1', profiles: { notify_comments: true, notify_follows: true, notify_posts: true, suspended: false } },
    { endpoint: 'https://push.example/2', p256dh: 'k', auth: 'a', lang: 'en', user_id: 'u1', profiles: { notify_comments: true, notify_follows: true, notify_posts: true, suspended: false } },
    { endpoint: 'https://push.example/3', p256dh: 'k', auth: 'a', lang: 'ko', user_id: 'u2', profiles: { notify_comments: true, notify_follows: false, notify_posts: true, suspended: false } },
    { endpoint: 'https://push.example/4', p256dh: 'k', auth: 'a', lang: 'ko', user_id: 'u3', profiles: { notify_comments: true, notify_follows: true, notify_posts: true, suspended: true } },
  ]
  const deleted: string[] = []
  const db = {
    schema: () => ({
      from: () => ({
        select: () => ({ in: async (_: string, ids: string[]) => ({ data: subs.filter(sub => ids.includes(sub.user_id)), error: null }) }),
        delete: () => ({ in: async (_: string, endpoints: string[]) => { deleted.push(...endpoints); return { error: null } } }),
      }),
    }),
  } as unknown as Parameters<typeof sendPushes>[0]
  beforeEach(() => {
    push.sent.length = 0; push.fail.clear(); deleted.length = 0
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub'); vi.stubEnv('VAPID_PRIVATE_KEY', 'priv'); vi.stubEnv('VAPID_SUBJECT', 'mailto:qa@example.com')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('REQ-COMMUNITY-095 sends to every subscription of a recipient who wants that kind, in its language', async () => {
    await sendPushes(db, [
      { to: 'u1', kind: 'comment', actor: '돈키', target: 'deck', targetId: 'd1', title: '덱', excerpt: '굿' },
      { to: 'u2', kind: 'follow', actor: '돈키', target: 'user', targetId: 'u9' },
      { to: 'u3', kind: 'post', actor: '돈키', target: 'deck', targetId: 'd2', title: '새 덱' },
    ])
    expect(push.sent.map(entry => entry.endpoint)).toEqual(['https://push.example/1', 'https://push.example/2'])
    expect(push.sent[1].payload.url).toBe('/en/decks/d1#deck-comments-title')
  })

  it('REQ-COMMUNITY-095 forgets subscriptions the push service no longer knows', async () => {
    push.fail.set('https://push.example/2', 410)
    await sendPushes(db, [{ to: 'u1', kind: 'comment', actor: '돈키', target: 'deck', targetId: 'd1', title: '덱', excerpt: '굿' }])
    expect(deleted).toEqual(['https://push.example/2'])
  })

  it('REQ-COMMUNITY-095 sends nothing without server keys', async () => {
    vi.stubEnv('VAPID_PRIVATE_KEY', '')
    await sendPushes(db, [{ to: 'u1', kind: 'comment', actor: '돈키', target: 'deck', targetId: 'd1', title: '덱', excerpt: '굿' }])
    expect(push.sent).toEqual([])
  })

  it('REQ-COMMUNITY-095 comments, follows and new posts push after the response', () => {
    const calls: [string, RegExp][] = [
      ['app/api/decks/[id]/comments/route.ts', /after\(\(\) => pushForComment\(\s*'deck'/],
      ['app/api/planner/[id]/comments/route.ts', /after\(\(\) => pushForComment\(\s*'plan'/],
      ['app/api/community/profiles/[id]/follows/route.ts', /after\(\(\) => pushForFollow\(/],
      ['app/api/decks/route.ts', /after\(\(\) => pushForPost\(\s*'deck'/],
      ['app/api/planner/route.ts', /after\(\(\) => pushForPost\(\s*'plan'/],
    ]
    for (const [path, call] of calls) expect(source(path), path).toMatch(call)
  })
})

describe('push service worker', () => {
  it('REQ-SHARED-059 shows the notification and opens or focuses its page', () => {
    const worker = source('public/push-sw.js')
    expect(worker).toContain("addEventListener('push'")
    expect(worker).toContain('showNotification(')
    expect(worker).toContain("addEventListener('notificationclick'")
    expect(worker).toContain('openWindow(')
    expect(worker).toContain('.focus()')
  })

  it('REQ-SHARED-059 is left alone by the development worker cleanup', () => {
    expect(source('components/pwa/ServiceWorkerRegister.tsx')).toMatch(/PUSH_SCOPE/)
  })
})

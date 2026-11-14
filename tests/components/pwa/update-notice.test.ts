import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/server', () => ({ connection: async () => {} }))
import { GET } from '@/app/api/version/route'
import { isNewBuild } from '@/components/pwa/UpdateNotice'

const root = resolve(__dirname, '../../..')
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('update notice', () => {
  it('tells the page the build the server runs now, never from a cache', async () => {
    const response = await GET()
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? null })
    // each build gets its own number: the deploy build's commit, else the time of the build
    expect(source('next.config.ts')).toMatch(/NEXT_PUBLIC_BUILD_ID: process\.env\.GITHUB_SHA \|\| String\(Date\.now\(\)\)/)
  })

  it('asks to reload only when the server runs another build than the page', () => {
    expect(isNewBuild('a', 'b')).toBe(true)
    expect(isNewBuild('a', 'a')).toBe(false)
    // no answer (offline, an error page) or a page without a number never asks
    expect(isNewBuild('a', null)).toBe(false)
    expect(isNewBuild(undefined, 'b')).toBe(false)
  })

  it('shows a small closable card in the bottom-left corner with one reload button, never a popup over the page', () => {
    const notice = source('components/pwa/UpdateNotice.tsx')
    expect(notice).toMatch(/registration\?\.update\(\)/)
    expect(notice).toMatch(/location\.reload\(\)/)
    expect(notice).not.toMatch(/sonner|toast\(/)
    expect(notice).toContain('onClick={() => setClosed(true)}')
    expect(source('app/[lang]/layout.tsx')).toContain('<UpdateNotice />')
    const css = source('styles/globals/popups.css')
    expect(css).toMatch(/\.update-notice \{ position:fixed; left:[^}]*bottom:[^}]*border:1px solid var\(--border\)/)
    expect(css).not.toMatch(/\.update-notice[^}]*(backdrop-filter|border-left)/)
    for (const lang of ['ko', 'en', 'ja']) {
      const common = JSON.parse(source(`messages/${lang}.json`)).common
      expect(common.updateAvailable, lang).toBeTruthy()
      expect(common.updateReload, lang).toBeTruthy()
    }
  })
})

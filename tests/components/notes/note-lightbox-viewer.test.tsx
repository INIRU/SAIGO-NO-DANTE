import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import NoteBlockViewer from '@/components/notes/NoteBlockViewer'

vi.hoisted(() => { process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://notes.example.supabase.co' })
vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('swr', () => ({ default: () => ({ data: undefined, error: null, isLoading: true, mutate: () => {} }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

const src = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/limbus-assets/notes/123e4567-e89b-12d3-a456-426614174000.webp`
const render = (...content: object[]) => renderToStaticMarkup(<NoteBlockViewer doc={{ type: 'doc', content }} renderText={t => t} />)

it('REQ-COMMUNITY-059 a note image is a button that opens it large, named after its description', () => {
  const html = render({ type: 'image', attrs: { src, alt: '편성표' } })
  expect(html).toMatch(/<button[^>]*class="note-image-button"[^>]*aria-label="이미지 크게 보기: 편성표"/)
  expect(html).toContain('class="note-document-image"')
  expect(html).not.toContain('role="dialog"')
})
it('REQ-COMMUNITY-059 an image that is not from the notes storage is still dropped', () => {
  expect(render({ type: 'image', attrs: { src: 'https://example.com/a.png', alt: 'x' } })).not.toContain('<img')
})
it('REQ-COMMUNITY-059 the backdrop is the deep background token and the stylesheet keeps the grow-out off for reduced motion', () => {
  const modal = readFileSync('components/notes/NoteLightboxImage.tsx', 'utf8')
  expect(modal).toContain('backdrop="color-mix(in srgb, var(--bg-deep) 94%, transparent)"')
  expect(modal).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
})

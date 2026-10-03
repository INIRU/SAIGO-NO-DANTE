import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import InquiriesPage from '@/app/[lang]/admin/inquiries/page'

vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
vi.mock('@/components/support/SupportDesk', () => ({
  default: ({ admin, initialId }: { admin?: boolean; initialId?: string }) => <div data-desk={admin ? 'admin' : 'user'} data-initial-id={initialId ?? ''} />,
}))

const page = async (query: Record<string, string | string[]>) =>
  renderToStaticMarkup(await InquiriesPage({ params: Promise.resolve({ lang: 'ko' }), searchParams: Promise.resolve(query) }))

it('REQ-ADMIN-008 the inbox starts on the inquiry named in the address, and on the list without one', async () => {
  const id = '8a5b7a52-5f0f-4d0e-9f3c-0d2b2f4a1c11'
  expect(await page({ id })).toContain(`data-desk="admin" data-initial-id="${id}"`)
  expect(await page({})).toContain('data-desk="admin" data-initial-id=""')
  expect(await page({ id: [id, 'other'] })).toContain('data-initial-id=""')
  // The id becomes part of a request path in the browser: anything that is not an inquiry id is dropped.
  for (const bad of ['../../notifications', '.', 'not-an-id']) expect(await page({ id: bad })).toContain('data-initial-id=""')
})

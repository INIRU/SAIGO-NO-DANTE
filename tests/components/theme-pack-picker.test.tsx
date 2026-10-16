import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/components/ui/BaseModal', () => ({ default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null) }))

import { ThemePackPickerModal } from '@/components/ui/ThemePackModal'
import { filterStyles } from '@/components/board/FilterControls'

const theme = { id: 1014, name: '기어오는 심연', image_url: null, ego_gift_ids: [1, 2, 3], floor_info: null }

describe('REQ-PLANNER-028 theme pack picker', () => {
  it('REQ-PLANNER-028 uses the shared picker frame and shows no gift counts', () => {
    const html = renderToStaticMarkup(
      <ThemePackPickerModal title="5층 테마팩" closeLabel="닫기" emptyLabel="없음" searchLabel="검색" noResultsLabel="결과 없음"
        countLabel={count => `${count}개`} themes={[theme]} onClose={() => {}} onSelectTheme={() => {}} lang="ko" />,
    )
    expect(html).toContain('기어오는 심연')
    expect(html).not.toMatch(/기프트\s*3/)
    expect(html).toContain(filterStyles.picker)
    expect(html).toContain(filterStyles.pickerGrid)
  })
})

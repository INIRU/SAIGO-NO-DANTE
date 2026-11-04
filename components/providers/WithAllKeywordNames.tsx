import type { ReactNode } from 'react'
import { KeywordProvider } from '@/components/providers/KeywordProvider'
import { getKeywordCatalog } from '@/lib/keywords/server-data'

/** Wraps a route section that searches keywords in every language: the layout's catalogue only has the page language's names. */
export default async function WithAllKeywordNames({ children }: { children: ReactNode }) {
  // A failed read is not cached; the section then keeps the layout's catalogue (page language only).
  const keywords = await getKeywordCatalog('all').catch(() => null)
  return keywords ? <KeywordProvider keywords={keywords}>{children}</KeywordProvider> : <>{children}</>
}

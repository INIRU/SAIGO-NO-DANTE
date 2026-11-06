'use client'
import type { ReactNode } from 'react'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'

/** Every page of the Index mode is its own screen: the site's navigation and footer are hidden from the first paint. */
export default function PrescriptChrome({ children }: { children: ReactNode }) {
  useHtmlFlag('with-prescript')
  return <>{children}</>
}

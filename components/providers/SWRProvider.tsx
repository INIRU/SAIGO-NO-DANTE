'use client'

import { SWRConfig } from 'swr'
import { fetchJson } from '@/lib/utils/http'

const fetcher = (url: string) => fetchJson(url)

export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        dedupingInterval: 5000,
      }}
    >
      {children}
    </SWRConfig>
  )
}

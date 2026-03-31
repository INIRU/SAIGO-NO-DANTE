'use client'

import { SWRConfig } from 'swr'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
})

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

'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface SelectionContextValue {
  selected: Set<string>
  toggleSelect: (id: string) => void
  clearAll: () => void
}

const SelectionContext = createContext<SelectionContextValue>({
  selected: new Set(),
  toggleSelect: () => {},
  clearAll: () => {},
})

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearAll = useCallback(() => setSelected(new Set()), [])

  return (
    <SelectionContext.Provider value={{ selected, toggleSelect, clearAll }}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection() {
  return useContext(SelectionContext)
}

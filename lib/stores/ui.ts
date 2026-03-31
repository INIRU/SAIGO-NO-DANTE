import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  /** 사이드바 열림 여부 (모바일) */
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  /** 최근 본 수감자 slug 목록 (최대 10개) */
  recentSinners: string[]
  addRecentSinner: (slug: string) => void

  /** 검색 기록 (최대 20개) */
  searchHistory: string[]
  addSearchHistory: (query: string) => void
  clearSearchHistory: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      recentSinners: [],
      addRecentSinner: (slug) =>
        set((state) => ({
          recentSinners: [slug, ...state.recentSinners.filter((s) => s !== slug)].slice(0, 10),
        })),

      searchHistory: [],
      addSearchHistory: (query) =>
        set((state) => ({
          searchHistory: [query, ...state.searchHistory.filter((q) => q !== query)].slice(0, 20),
        })),
      clearSearchHistory: () => set({ searchHistory: [] }),
    }),
    {
      name: 'limbus-ui',
      partialize: (state) => ({
        recentSinners: state.recentSinners,
        searchHistory: state.searchHistory,
      }),
    },
  ),
)

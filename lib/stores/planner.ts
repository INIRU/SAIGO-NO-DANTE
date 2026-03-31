import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  plannerReducer,
  createInitialState,
  type PlannerState,
  type PlannerAction,
} from '@/lib/planner/types'

interface PlannerStore extends PlannerState {
  dispatch: (action: PlannerAction) => void
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set) => ({
      ...createInitialState('hard'),
      dispatch: (action: PlannerAction) =>
        set((state) => {
          const { dispatch: _, ...current } = state
          const next = plannerReducer(current, action)
          return next
        }),
    }),
    {
      name: 'md-planner-draft',
      partialize: (state) => ({
        difficulty: state.difficulty,
        title: state.title,
        description: state.description,
        identitySlots: state.identitySlots,
        egoSlots: state.egoSlots,
        floorPlan: state.floorPlan,
        giftInventory: state.giftInventory,
        activeTab: state.activeTab,
      }),
    },
  ),
)

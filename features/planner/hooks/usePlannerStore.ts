import { create } from 'zustand'
import {
  plannerReducer,
  createInitialState,
  type PlannerState,
  type PlannerAction,
} from '@/lib/planner/types'

interface PlannerStore extends PlannerState {
  dispatch: (action: PlannerAction) => void
}

export const usePlannerStore = create<PlannerStore>()((set) => ({
  ...createInitialState('hard'),
  dispatch: (action: PlannerAction) =>
    set((state) => {
      const { dispatch: _, ...current } = state
      const next = plannerReducer(current, action)
      return next
    }),
}))

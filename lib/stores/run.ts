import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  runReducer,
  createInitialRunState,
  type RunState,
  type RunAction,
} from '@/lib/planner/run-types'

interface RunStore extends RunState {
  dispatch: (action: RunAction) => void
}

export const useRunStore = create<RunStore>()(
  persist(
    (set) => ({
      ...createInitialRunState('hard'),
      dispatch: (action: RunAction) =>
        set((state) => {
          const { dispatch: _, ...current } = state
          const next = runReducer(current, action)
          return next
        }),
    }),
    {
      name: 'md-run-draft',
      partialize: (state) => ({
        phase: state.phase,
        difficulty: state.difficulty,
        startFloor: state.startFloor,
        maxFloors: state.maxFloors,
        currentFloor: state.currentFloor,
        activeSubTab: state.activeSubTab,
        identitySlots: state.identitySlots,
        egoSlots: state.egoSlots,
        skillArrangements: state.skillArrangements,
        floorLogs: state.floorLogs,
        giftInventory: state.giftInventory,
        sourcePlanEncoded: state.sourcePlanEncoded,
        targetGifts: state.targetGifts,
      }),
    },
  ),
)

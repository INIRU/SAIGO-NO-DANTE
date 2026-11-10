// 클라이언트에서도 쓸 수 있는 순수 코드만. 컴포넌트는 `@/features/planner/components/<이름>`, 스토어는 `@/features/planner/hooks/<이름>`으로 가져온다.
// `lib/planner/`에 남은 것: 플랜 모델(`types`, `constraints`, `floor-difficulty`), 조합·기프트 조건·패시브 계산(`fusion`, `gift-condition-status`, `passives`), 목록용 가공(`stripPlanForList`), 편성 코드 변환(`team-code-import`, `formation-transfer`), `pip-view`(PiP 미리보기 라우트가 입구를 가져오면 인코더 묶음이 딸려 옴), `gift-plan-constants`, `catalog-references`.
// 덱·카탈로그·노트·거울 던전·도구·메타가 쓰고 `lib/meta`도 쓴다. 이 입구에 두면 닫힌 모듈 묶음(약 200KB)이 입구를 가져오는 모든 라우트 첫 JS에 딸려 와서(트리 셰이킹이 되지 않음) 공용에 둔다.
export { decodePlan, decodedPlanToPlannerState, encodePlan, clearDraftFromLocal, deletePlannerTempSlot, isPlannerState, loadDraftFromLocal, loadPlanForRun, loadPlannerTempSlots, runStateToPlannerState, saveDraftToLocal, savePlanForRun, savePlannerTempSlot, snapshotPlannerState } from './lib/encoder'
export type { PlannerTempSlot } from './lib/encoder'
export { MAX_PRESET_GIFTS, MAX_PRESET_NAME, USER_SLOTS, isFinalGiftKey } from './lib/final-presets'
export { getSelectedBlessingCost, getSelectedBlessingLevels, normalizeBlessingMessages } from './lib/blessing'
export type { Blessing } from './lib/blessing'
export { withLcbIdentitySlots } from './lib/lcb'
export { OBSERVATION_COLUMNS, observationCost, observationFrom } from './lib/observation'
export type { Observation, ObservationRow } from './lib/observation'
export { giftBadges } from '@/lib/planner/pip-view'
export { trimPlanDetailCatalog, slimPlanThemes } from './lib/plan-detail-catalog'
export { planFormationCount } from './lib/plan-formation-count'
export { normalizeRunState } from './lib/run-normalize'
export type { RunState } from './lib/run-types'

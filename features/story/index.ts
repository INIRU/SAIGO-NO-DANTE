// 타입과 순수 함수만. 훅은 `@/features/story/hooks/<이름>`으로 가져온다.
export { DungeonGL } from './lib/dungeon-gl'
export type { Cam, Item, Slice } from './lib/dungeon-gl'
export { GIFT_KEYWORD, INK, L, SIN_ICON, TONE, checkChain, condLabel, giftArt, lockGifts, monitorText, nine, pickText, reach, ui } from './lib/dungeon-event-flow'
export type { CheckEvent, ChoiceEvent, Ctx, Lang, Reward, Step } from './lib/dungeon-event-flow'
export { chapterParts, isExtraPart, isHiddenChapter, storyOrder } from './lib/story-order'
// 스토리 맵(챕터 지도) 화면의 문구·약점 표시 계산과 카메라 계산. 던전 쪽 이름(L, Cam)과 겹쳐 별칭으로 내보낸다.
export { L as MAP_COPY, effective as effectiveWeaknesses, text as mapText } from './lib/story-copy'
export { STRIDE, VIEWPORT, clampCamera, visibleHeight } from './lib/story-camera'
export type { Cam as MapCam } from './lib/story-camera'
// PixiJS(pixi.js)를 끌어오는 효과 레이어는 입구에서 정적으로 가져오지 않고, 쓸 때 불러온다.
export const loadFxLayer = () => import('./lib/fx/layer')

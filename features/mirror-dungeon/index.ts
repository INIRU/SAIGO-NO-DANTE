// 클라이언트에서도 쓸 수 있는 순수 코드만. 컴포넌트·훅은 `@/features/mirror-dungeon/components/<이름>`, `@/features/mirror-dungeon/hooks/<이름>`으로 가져온다.
export type { ChoiceEffect, EgoGift, EgoGiftTheme, MdEvent, MdEventChoice, Recipe } from './types'
export { eventResultCondition, groupEventChoices } from './lib/event-flow'

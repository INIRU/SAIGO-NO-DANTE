// 클라이언트에서도 쓸 수 있는 순수 코드만. 컴포넌트·훅은 `@/features/community/components/<이름>`, `@/features/community/hooks/<이름>`으로 가져온다.
// zod 스키마와 추천 계산처럼 클라이언트 묶음에 실리면 안 되는 순수 코드는 `@/features/community/server`로 내보낸다. 타입은 `export type`으로만 내보내 모듈을 끌어오지 않는다.
export { getCommunityCopy } from './lib/copy'
export { FAUST_FACES, markFaceSeen, readSeenFaces } from './lib/faust-faces'
export { pickShelf } from './lib/shelf'
export type { DiscoveryFeed } from './lib/shelf'
export type { CommunityProfile } from './lib/rules'
export type { SeriesView } from './lib/series-order'

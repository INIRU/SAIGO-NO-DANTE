// 클라이언트에서도 쓸 수 있는 순수 코드만. 컴포넌트·훅은 `@/features/friends/components/<이름>`, `@/features/friends/hooks/<이름>`으로 가져온다.
export {
  FRIEND_CODE_RE, VISIBILITIES, WANT_LIMIT, codeForViewer, fail, isRequestDecision, newlyWanted, nextBumpedAt,
  parseSupportPost, parseWantPost, seenIsStale, slotAssetIds, wantExpiresAt, wantIdentityIds,
  type StoredSlot, type Visibility,
} from './lib/codes'

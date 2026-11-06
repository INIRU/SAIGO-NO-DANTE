// 서버 전용 입구. 익명 글쓴이 확인, 개발자 API 키·조회 코드.
export { allows, consumeApiKey, type KeyAccess } from './developer-access'
export { createApiKey } from './developer-keys'
export {
  authorColumns, authorRateKey, guestKeyFrom, guestKeyHash, guestPinHash, guestPinOf, ownsPost, recordGuestAuthorship, resolveAuthor,
  type Author, type GuestPinKind,
} from './guest'
export { RESOURCES, parseLang, presentCatalogItem, presentDeck, presentPlan, withLinks } from '../lib/partner-api'
export { loadCatalog, loadCatalogItem, loadDeckDetail, loadPlanDetail } from './partner-data'

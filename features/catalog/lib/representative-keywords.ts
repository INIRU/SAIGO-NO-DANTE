import type { Identity } from '@/lib/data/sinners'

type IdentityWithRepresentativeKeywords = Identity & {
  skill_keyword_list?: string[] | null
  keywords?: string[] | null
}

/** The keywords an identity card shows and filters by: its skills' keyword list, else the identity's own. */
export function getRepresentativeKeywords(identity: IdentityWithRepresentativeKeywords) {
  return identity.skill_keyword_list && identity.skill_keyword_list.length > 0
    ? identity.skill_keyword_list
    : (identity.keywords ?? [])
}

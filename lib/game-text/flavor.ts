/** Colour of the game's flavor lines (the brown italic text under skills, passives and keyword descriptions). */
export const FLAVOR_COLOR = '#9b6b43'

/** The key of a keyword_meta row's flavor line in the flavors of /api/game-text-refs (the game ids are the other keys). */
export const flavorKeyOfKeyword = (keywordName: string) => `kw:${keywordName}`

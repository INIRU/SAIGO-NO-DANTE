// Server-only code: the preset API route reads the preset schema (zod and pako stay out of the client index); the pages read the static game data queries.
export { giftsQuery, observationQuery, recipesQuery, themesQuery } from './static-data'
export { GIFT_PRESET_LIMIT } from '../lib/gift-presets'
export { giftPresetBodySchema } from '../lib/gift-preset-code'

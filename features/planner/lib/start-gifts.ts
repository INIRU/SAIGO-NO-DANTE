import startGifts from '@/lib/data/start-gifts.json'

/** Start E.G.O gifts of the Mirror Dungeon, three per keyword (game common data; regenerate with scripts/data/start-gifts.mjs). */
export const START_GIFT_IDS: ReadonlySet<number> = new Set(startGifts.pools.flatMap(pool => pool.giftIds))

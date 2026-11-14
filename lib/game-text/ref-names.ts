/**
 * What a `[Id]` of raw game text is, in one language: its kind, label and (keywords) the keyword_meta row it maps to.
 * `i` is the buff's own icon file (game_text_refs.icon_slug); without one it draws keyword_meta's.
 */
export type GameTextRefName = { k: 'keyword' | 'skilltag'; n: string; kw?: string; i?: string }
export type GameTextRefNames = Record<string, GameTextRefName>

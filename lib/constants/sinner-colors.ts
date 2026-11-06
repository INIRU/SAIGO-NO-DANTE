/**
 * Each sinner's colour, taken from the game's own number plate (assets/game-ui/sinners/<id>): its most common coloured
 * pixel, lifted where the plate colour is too dark to read as text on the site's dark background (Yi Sang, Rodion,
 * Outis, Gregor) — same hue, more light.
 */
export const SINNER_COLORS: Record<string, string> = {
  'yi-sang': '#a9c0d6',
  faust: '#f4a6a6',
  'don-quixote': '#f2df3a',
  ryoshu: '#e2342e',
  meursault: '#6f8ee6',
  'hong-lu': '#5ee8cc',
  heathcliff: '#a874e6',
  ishmael: '#f7a12a',
  rodion: '#d0463f',
  sinclair: '#b7c43a',
  outis: '#7fae76',
  gregor: '#c4844a',
}

export const sinnerColor = (id: string) => SINNER_COLORS[id] ?? 'var(--gold-light)'

/** Affiliation (association_list key) → its signature keyword icon; scripts/assets/copy-affiliation-icons.mjs makes the files. */
const ICON: Record<string, string> = {
  '새벽 사무소': 'dawn',
  '흑운회': 'black-cloud',
  'N사': 'n-corp',
  'N사 광신도': 'n-corp',
  '검지': 'index',
  '흑수': 'heishou',
  '중지': 'middle',
  '엄지': 'thumb',
  '검계': 'blade-lineage',
  'T사': 't-corp',
  '라만차랜드': 'la-manchaland',
  '장미스패너 공방': 'rosespanner',
}

/** Icon for an affiliation filter option, or null when the game has no clear symbol for it. */
export function getAffiliationIconUrl(affiliation: string): string | null {
  const slug = ICON[affiliation]
  return slug ? `/assets/game-ui/affiliations/${slug}.webp` : null
}

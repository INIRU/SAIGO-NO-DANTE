import titles from '@/lib/data/identity-card-titles.json'

type Lang = 'ko' | 'en' | 'ja'
const TITLES = titles as Record<string, Partial<Record<Lang, string>>>

/**
 * Identity name lines as the in-game formation card prints them: the game's own title carries its line breaks
 * ("LCB\n수감자", "정사무소\n대표"); titles without one ("흑수 - 미") stay on one line.
 * The data comes from the extractor (the Windows extraction tool), not from this repo.
 */
export function identityNameLines(name: string, gameId?: string | number | null, locale: string = 'ko'): string[] {
  const lang: Lang = locale === 'en' || locale === 'ja' ? locale : 'ko'
  const title = gameId != null ? TITLES[String(gameId)]?.[lang] : undefined
  return (title ?? name).split('\n').map(line => line.trim()).filter(Boolean)
}

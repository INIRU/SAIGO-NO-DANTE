/** A file name Storage accepts: Storage keys must be ASCII, so a game name with other letters (the boss icons 요정,
 * 강화인간 ...) is stored as u + its UTF-8 bytes in hex. The site asks for files by this name; the story map upload
 * (scripts/data/upload-story-map.ts) names them the same way. */
export function storageName(name: string): string {
  return /^[ -~]*$/.test(name) ? name : 'u' + Array.from(new TextEncoder().encode(name), b => b.toString(16).padStart(2, '0')).join('')
}

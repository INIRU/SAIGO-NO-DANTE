/** An unnamed event takes its title from the first line of its text when that line fits within this many characters. */
const TITLE_LIMIT = 40

/**
 * The text under an event's title. An unnamed event is titled by its own first line, so that line
 * is left out here; a longer first line is only cut for the title and stays in the text.
 */
export function eventStory(desc: string | null | undefined, name: string | null | undefined): string | null {
  if (!desc) return null
  if (name) return desc
  const firstLine = desc.split('\n')[0]
  if (firstLine.length > TITLE_LIMIT) return desc
  return desc.slice(firstLine.length).replace(/^\n+/, '') || null
}

/** ISO release dates sort newest first; unknown dates stay last with a stable ID tie-break. */
export function compareReleaseDate(a: { id: string; release_date?: string | null }, b: { id: string; release_date?: string | null }): number {
  return (b.release_date ?? '').localeCompare(a.release_date ?? '') || a.id.localeCompare(b.id)
}

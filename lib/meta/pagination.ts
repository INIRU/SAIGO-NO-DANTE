/** Follow the server's returned row count; a configured cap may be below our page size. */
export async function readAllMetaRows<T>(readPage: (from: number, to: number) => PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}>, pageSize = 500): Promise<T[]> {
  const rows: T[] = []
  while (true) {
    const { data, error } = await readPage(rows.length, rows.length + pageSize - 1)
    if (error) throw new Error(`Meta query failed: ${error.message}`)
    if (!data) throw new Error('Meta query returned no result')
    if (data.length === 0) return rows
    rows.push(...data)
  }
}

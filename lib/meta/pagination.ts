type Page<Row> = (from: number, to: number) => PromiseLike<{
  data: Row | null
  error: { message: string } | null
}>

/**
 * Follow the server's returned row count; a configured cap may be below our page size.
 * Without a type argument the rows keep the shape the query returns. With one, `T` is checked against that shape when
 * it fits; when it does not (a hand-written row type for nullable columns) the second form takes `T` as the caller's
 * own claim about the rows.
 */
export async function readAllMetaRows<T>(readPage: Page<T[]>, pageSize?: number): Promise<T[]>
export async function readAllMetaRows<T>(readPage: Page<readonly unknown[]>, pageSize?: number): Promise<T[]>
export async function readAllMetaRows<T>(readPage: Page<readonly unknown[]>, pageSize = 500): Promise<T[]> {
  const rows: T[] = []
  while (true) {
    const { data, error } = await readPage(rows.length, rows.length + pageSize - 1)
    if (error) throw new Error(`Meta query failed: ${error.message}`)
    if (!data) throw new Error('Meta query returned no result')
    if (data.length === 0) return rows
    rows.push(...(data as T[]))
  }
}

/** readAllMetaRows as a { data, error } result, for callers that report errors instead of throwing. */
export function readAllRows<T>(readPage: Page<T[]>) {
  return readAllMetaRows<T>(readPage, 1000).then(data => ({ data, error: null }), (error: Error) => ({ data: null, error }))
}

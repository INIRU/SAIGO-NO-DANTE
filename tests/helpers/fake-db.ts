/**
 * A stand-in for the Supabase admin client: every query method returns the same chain, and awaiting the chain (or
 * `.single()` / `.maybeSingle()`) answers with whatever `reply` says for that table and first operation.
 */
export type DbError = { code?: string; message: string }
export type Reply = { data?: unknown; error?: DbError | null; count?: number | null }
/** payload: the rows of an insert/update/upsert; for a select, { columns, options }. */
export type Query = { table: string; op: string; ops: string[]; payload?: unknown }

export function fakeDb(reply: (query: Query) => Reply | undefined, log: Query[] = []) {
  const answer = (query: Query) => {
    log.push(query)
    const given = reply(query) ?? {}
    return { data: given.data ?? null, error: given.error ?? null, count: given.count ?? null }
  }
  const from = (table: string) => {
    const start = (op: string, payload?: unknown) => {
      const query: Query = { table, op, ops: [op], payload }
      const chain: unknown = new Proxy({}, {
        get: (_target, method: string) => {
          if (method === 'then') return (resolve: (value: unknown) => unknown) => resolve(answer(query))
          return () => { query.ops.push(method); return chain }
        },
      })
      return chain
    }
    return {
      select: (columns?: string, options?: { head?: boolean; count?: string }) => start('select', { columns, options }),
      insert: (payload: unknown) => start('insert', payload),
      update: (payload: unknown) => start('update', payload),
      upsert: (payload: unknown) => start('upsert', payload),
      delete: () => start('delete'),
    }
  }
  const rpc = async (name: string, payload?: unknown) => answer({ table: `rpc:${name}`, op: 'rpc', ops: ['rpc'], payload })
  return { schema: () => ({ from, rpc }) }
}

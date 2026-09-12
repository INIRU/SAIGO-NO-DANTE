type OutcomeRow = { sort_order: number; message: string | null; outcome?: string | null }
export type EventOutcomeKind = 'success' | 'failure' | 'other'

/** Importer order is option * 100 + reward variant, not a success/failure flag. */
export function getEventOutcomes<T extends OutcomeRow>(rows: readonly T[]): Array<{ choice: T; kind: EventOutcomeKind }> {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order).map(choice => {
    const label = choice.message?.trim() ?? ''
    const kind = choice.outcome === 'success' || choice.outcome === 'failure' ? choice.outcome : /^(성공|成功|success)(?:\s*\d+)?$/i.test(label) ? 'success'
      : /^(실패|失敗|failure)(?:\s*\d+)?$/i.test(label) ? 'failure' : 'other'
    return { choice, kind }
  })
}

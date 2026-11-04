import { afterEach, describe, expect, it } from 'vitest'
import { clearLog, isVerbose, LOG_MAX, logEntries, logFile, plog, setVerbose } from '../../../lib/vision/assist-log'

describe('the Assist log', () => {
  afterEach(() => { clearLog(); setVerbose(false) })

  it('keeps the last LOG_MAX entries in order', () => {
    for (let i = 0; i < LOG_MAX + 5; i++) plog('scene', i)
    const entries = logEntries()
    expect(entries).toHaveLength(LOG_MAX)
    expect(entries[0].data).toBe(5)
    expect(entries.at(-1)!.data).toBe(LOG_MAX + 4)
  })

  it('keeps frequent entries (the cursor) only while verbose', () => {
    plog('cursor', [1, 2], true)
    expect(logEntries()).toHaveLength(0)
    setVerbose(true)
    expect(isVerbose()).toBe(true)
    plog('cursor', [1, 2], true)
    expect(logEntries().map(entry => entry.kind)).toEqual(['cursor'])
  })

  it('exports the entries with the state given', () => {
    plog('room', { eventId: 901040 })
    const file = logFile({ status: 'running' }, Date.UTC(2026, 10, 4))
    expect(file).toMatchObject({ app: 'assist', exportedAt: '2026-11-04T00:00:00.000Z', state: { status: 'running' }, entries: [{ kind: 'room', data: { eventId: 901040 } }] })
  })
})

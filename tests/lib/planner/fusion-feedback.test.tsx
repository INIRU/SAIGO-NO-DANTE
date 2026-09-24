import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CompanionAcquisitionOverlay, { fusionFeedback, inventoryDelta, takeNewAcquisitions, type AcquisitionOverlayEvent } from '@/components/planner/run/CompanionAcquisitionOverlay'

const describe = (id: string) => id === '9999' ? null : { gift: { name: `gift ${id}` }, name: `gift ${id}` }

it('computes what one inventory step removed and added, counting repeated ids', () => {
  expect(inventoryDelta(['1', '2', '3'], ['3', '9'])).toEqual({ removed: ['1', '2'], added: ['9'] })
  expect(inventoryDelta(['1', '1', '2'], ['1', '2'])).toEqual({ removed: ['1'], added: [] })
  expect(inventoryDelta(['1'], ['1'])).toEqual({ removed: [], added: [] })
})

it('announces a recognized fusion as one consumption notice of the removed materials, then its result', () => {
  const events = fusionFeedback('run:fusion:100', 5, ['9236', '9047', '9159', '9001'], ['9001', '9115'], '9115', describe)
  expect(events.map(event => event.kind ?? 'acquired')).toEqual(['consumed', 'acquired'])
  expect(events[0]).toMatchObject({ kind: 'consumed', token: 'run:fusion:100:consumed', materials: [{ name: 'gift 9236' }, { name: 'gift 9047' }, { name: 'gift 9159' }] })
  expect(events[1]).toMatchObject({ token: 'run:fusion:100:result', name: 'gift 9115' })
})

it('shows only what actually changed: no result already listed, no material that did not leave', () => {
  // The result was already in the inventory (listed): only the materials leave, no acquisition is announced.
  expect(fusionFeedback('f', 5, ['9116', '9192', '9111'], ['9111'], '9111', describe).map(event => event.kind ?? 'acquired')).toEqual(['consumed'])
  // A vestige absent from the inventory is never shown; nothing removed means no consumption notice.
  expect(fusionFeedback('f', 5, ['9001'], ['9001', '9002'], '9002', describe).map(event => event.kind ?? 'acquired')).toEqual(['acquired'])
  // A late upgrade compared with what was shown (result already announced): only the consumption.
  const late = fusionFeedback('f', 5, ['9199', '9702', '9768'], ['9768'], '9768', describe)
  expect(late).toHaveLength(1)
  expect(late[0]).toMatchObject({ kind: 'consumed', materials: [{ name: 'gift 9199' }, { name: 'gift 9702' }] })
  // A gift without catalog art is left out rather than guessed.
  expect(fusionFeedback('f', 5, ['9999', '9001'], ['9003'], '9003', describe)[0]).toMatchObject({ materials: [{ name: 'gift 9001' }] })
})

it('keeps one stable id per fusion, so the same fusion never plays twice and restored events stay silent', () => {
  const first = fusionFeedback('run:fusion:100', 1000, ['1', '2'], ['3'], '3', describe)
  const again = fusionFeedback('run:fusion:100', 1000, ['1', '2'], ['3'], '3', describe)
  expect(again.map(event => event.token)).toEqual(first.map(event => event.token))
  const seen = new Set<string>()
  expect(takeNewAcquisitions(first, seen, 1500)).toHaveLength(2)
  expect(takeNewAcquisitions([...first, ...again], seen, 1600)).toHaveLength(0)
  // Events present when the overlay mounts (reopened window, hydration) are history.
  const html = renderToStaticMarkup(<CompanionAcquisitionOverlay events={first as AcquisitionOverlayEvent[]} label="획득" consumedLabel="합성 재료 소모" />)
  expect(html).not.toContain('data-consumed-overlay')
  expect(html).toContain('pointer-events-none')
})

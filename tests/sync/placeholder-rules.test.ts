import { describe, expect, it } from 'vitest'
import sources from '../fixtures/placeholder-sources.json'
import {
  buffPlaceholders,
  eventPlaceholders,
  giftPlaceholders,
  PlaceholderReport,
  PLACEHOLDER_CHECK_COLUMNS,
  rowsWithRawPlaceholders,
} from '@/scripts/sync/placeholder-rules'
import { hasRawPlaceholder } from '@/lib/game-text/placeholders'

// tests/fixtures/placeholder-sources.json holds the source strings of complete-data 2026-09-24 verbatim.
const LANGS = ['KR', 'EN', 'JP'] as const
const { gifts, buffs, events } = sources

describe('REQ-DATA-SYNC-032 gift slots (convertDataList / descType)', () => {
  it('9242 봉이 인형 (descType ReportBongy): both counters are live values in every language', () => {
    const gift = { id: 9242, ...gifts['9242'] }
    expect(gift.convertTo).toBeNull()
    expect(gift.descType).toBe('ReportBongy')
    const report = new PlaceholderReport()
    const kr = giftPlaceholders(gift.desc.KR, gift, report)
    expect(kr).toContain('피해량 0.5% 증가 (현재 {{live}}%. 최대 100%)')
    expect(kr).toContain('(현재 {{live}} 얻음. 최대 10)')
    expect(giftPlaceholders(gift.desc.EN, gift, report)).toContain('(Current: +{{live}}%; max 100%)')
    expect(giftPlaceholders(gift.desc.JP, gift, report)).toContain('(現在{{live}}獲得、最大10)')
    for (const lang of LANGS) expect(hasRawPlaceholder(giftPlaceholders(gift.desc[lang], gift, report))).toBe(false)
    expect(report.size).toBe(0)
  })

  it('9227 귀기 서린 환도 (convertDataList [9228]): {0} names the gift it turns into', () => {
    const gift = { id: 9227, ...gifts['9227'] }
    expect(gift.convertTo).toBe(9228)
    for (const lang of LANGS) {
      const text = giftPlaceholders(gift.desc[lang], gift)!
      expect(text.split('\n')[1]).toBe('{{gift:9228}}')
      expect(hasRawPlaceholder(text)).toBe(false)
    }
  })

  it('reports a gift slot neither field explains, stored as {{value}}', () => {
    const report = new PlaceholderReport()
    expect(giftPlaceholders('현재 {0}', { id: 1 }, report)).toBe('현재 {{value}}')
    expect(report.lines()).toEqual(['⚠ 분류 안 된 자리표시 {0} (EGOgift: 1) → {{value}}로 저장'])
  })
})

describe('REQ-DATA-SYNC-032 buff and keyword slots', () => {
  it('Combustion: {0} potency, {1} count', () => {
    expect(buffPlaceholders(buffs.Combustion.KR, 'Combustion')).toBe('{{count}}턴 동안 턴 종료 시 {{potency}}만큼 고정 체력 피해를 입음')
    expect(buffPlaceholders(buffs.Combustion.EN, 'Combustion')).toBe('Turn End: Take {{potency}} fixed damage. Lasts {{count}} turn(s).')
    expect(buffPlaceholders(buffs.Combustion.JP, 'Combustion')).toBe('{{count}}ターンの間、ターン終了時に{{potency}}の固定ダメージを受ける')
  })

  it('SinkingWhite (Butterfly): {2}/{3} are amounts computed in battle, and its own "(위력)" wording stays text', () => {
    const report = new PlaceholderReport()
    const kr = buffPlaceholders(buffs.SinkingWhite.KR, 'SinkingWhite', report)!
    expect(kr).toContain('공격자의 정신력을 {{live}}만큼 회복')
    expect(kr).toContain('{{live}}만큼 우울 피해를 받음')
    expect(kr).toContain('산나비(위력)만큼 침잠 부여')
    expect(buffPlaceholders(buffs.SinkingWhite.EN, 'SinkingWhite', report)).toContain('The Living(Potency)')
    for (const lang of LANGS) expect(hasRawPlaceholder(buffPlaceholders(buffs.SinkingWhite[lang], 'SinkingWhite', report))).toBe(false)
    expect(report.size).toBe(0)
  })

  it('TiedWithRope: {0} is the trussed enemy (exception table)', () => {
    expect(buffPlaceholders(buffs.TiedWithRope.KR, 'TiedWithRope')).toContain('- {{target}} 포박중')
    expect(buffPlaceholders(buffs.TiedWithRope.EN, 'TiedWithRope')).toContain('- Currently Trussing {{target}}')
    expect(buffPlaceholders(buffs.TiedWithRope.JP, 'TiedWithRope')).toContain('- {{target}}捕縛中')
  })

  it('formats such as {0:F1} are potency; a new slot is {{value}} and reported per source', () => {
    const report = new PlaceholderReport()
    expect(buffPlaceholders('대상의 참격 내성을 {0:F1} 감소', 'SlashResistUp', report)).toBe('대상의 참격 내성을 {{potency}} 감소')
    expect(buffPlaceholders('{5} 새 자리', 'XxxBuff', report, 'KR_Bufs')).toBe('{{value}} 새 자리')
    expect(report.lines()).toEqual(['⚠ 분류 안 된 자리표시 {5} (KR_Bufs: XxxBuff) → {{value}}로 저장'])
    expect(buffPlaceholders(null, 'Combustion')).toBeNull()
  })
})

describe('REQ-DATA-SYNC-032 event text', () => {
  it('97111202 김삿갓의 과거 3: the sinner sent is {{sinner}} in every language', () => {
    for (const lang of LANGS) {
      for (const text of [...events['97111202'][lang].successDesc, ...events['97111202'][lang].failureDesc]) {
        const stored = eventPlaceholders(text)
        expect(stored).toContain('{{sinner}}')
        expect(hasRawPlaceholder(stored)).toBe(false)
      }
    }
    expect(eventPlaceholders(events['97111202'].KR.successDesc[0])).toContain('{{sinner}} 수감자와 김삿갓이')
  })

  it('named sinner slot {affectedTarget} (1040201) becomes {{sinner}}; effect templates stay for the rebuild', () => {
    expect(eventPlaceholders('{affectedTarget} 수감자가 제일 상태가 좋지 않아 보였기에')).toBe('{{sinner}} 수감자가 제일 상태가 좋지 않아 보였기에')
    expect(eventPlaceholders('{reward} 획득')).toBe('{reward} 획득')
    expect(eventPlaceholders(null)).toBeNull()
  })
})

describe('REQ-DATA-SYNC-033 post-apply leftover check', () => {
  it('counts rows whose display columns still hold {0} or a single-brace name, never tokens', () => {
    const rows = [
      { game_id: 1, effect_base: '현재 {{live}}%', effect_base_en: null },
      { game_id: 2, effect_base: '현재 {0}%', effect_base_en: 'Current {1:F1}' },
      { game_id: 3, effect_base: '{amount} 획득', effect_base_en: '{{gift:9228}}' },
    ]
    const found = rowsWithRawPlaceholders(rows, PLACEHOLDER_CHECK_COLUMNS.ego_gifts)
    expect(found.map(item => [item.row.game_id, item.columns])).toEqual([[2, ['effect_base', 'effect_base_en']], [3, ['effect_base']]])
    expect(Object.keys(PLACEHOLDER_CHECK_COLUMNS)).toEqual(['ego_gifts', 'keyword_meta', 'passives', 'md_events', 'md_event_choices'])
  })
})

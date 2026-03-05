'use client'

import Image from 'next/image'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  Passive,
  getSinnerLogoUrl,
  getSkillIconUrl,
  computeSkillImageIndices,
  SIN_COLORS,
  SinType,
  GRADE_COLORS,
  SIN_ICON_MAP,
} from '@/lib/data/sinners'
import {
  NoteRenderer,
  type NoteSkillEntry,
  type NotePassiveEntry,
  type NoteEgoEntry,
  type NoteEgoGiftEntry,
} from '@/components/decks/NoteChips'
import { NoteAutocompleteDropdown, useNoteAutocomplete } from '@/components/notes/NoteAutocomplete'

// 한국어 죄악명 → SinType
const SIN_KR_TO_TYPE: Record<string, SinType> = {
  '분노': 'wrath', '색욕': 'lust', '나태': 'sloth', '탐식': 'gluttony',
  '우울': 'gloom', '오만': 'pride', '질투': 'envy',
}

interface Props {
  sinners: Sinner[]
  deckSlots: Record<string, Identity | undefined>
  egoSlots: Record<string, Record<string, EGO>>
  skillsByIdentityId: Record<string, Skill[]>
  passivesByIdentityId: Record<string, Passive[]>
  description: string
  setDescription: (v: string) => void
  descPreview: boolean
  setDescPreview: (v: boolean | ((prev: boolean) => boolean)) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  noteAc: ReturnType<typeof useNoteAutocomplete>
  skillTokenLookup: Record<string, NoteSkillEntry>
  passiveTokenLookup: Record<string, NotePassiveEntry>
  egoTokenLookup: Record<string, NoteEgoEntry>
  egoGiftLookup: Record<string, NoteEgoGiftEntry>
}

export default function DeckNoteEditor({
  sinners, deckSlots, egoSlots,
  skillsByIdentityId, passivesByIdentityId,
  description, setDescription,
  descPreview, setDescPreview,
  textareaRef, noteAc,
  skillTokenLookup, passiveTokenLookup, egoTokenLookup, egoGiftLookup,
}: Props) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(10,8,5,0.5)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: '#6a6a80', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>덱 노트</span>
        <button
          onClick={() => setDescPreview(v => !v)}
          className="text-xs px-2 py-0.5 rounded transition-all"
          style={{ color: descPreview ? 'var(--gold)' : '#6a6a80', border: `1px solid ${descPreview ? 'var(--gold)' : 'var(--border)'}`, background: descPreview ? 'rgba(200,144,10,0.08)' : 'transparent' }}
        >
          {descPreview ? '편집' : '미리보기'}
        </button>
      </div>

      {/* 인서트 도구모음 */}
      {!descPreview && (
        <div style={{ background: 'rgba(5,4,2,0.6)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {Object.values(deckSlots).filter(Boolean).length === 0 ? (
            <div className="px-4 py-3">
              <span style={{ color: '#252530', fontSize: '0.5625rem' }}>인격을 편성하면 스킬·패시브·E.G.O를 삽입할 수 있습니다</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* ── 스킬 ── */}
              <div className="flex items-start gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: '#555570', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', paddingTop: '4px', minWidth: '36px', flexShrink: 0 }}>스킬</span>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 flex-1">
                  {Object.values(deckSlots).filter((id): id is Identity => !!id).map(identity => {
                    const idSkills = skillsByIdentityId[identity.id] ?? []
                    if (idSkills.length === 0) return null
                    const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
                    const noteSkillImgIdx = computeSkillImageIndices(idSkills)
                    return (
                      <div key={identity.id} className="flex items-center gap-1.5">
                        <Image src={getSinnerLogoUrl(identity.sinner_id)} alt="" width={10} height={10} style={{ opacity: 0.3, flexShrink: 0 }} />
                        <div className="flex items-center gap-1">
                          {idSkills.map(sk => {
                            const iconUrl = getSkillIconUrl(identity, noteSkillImgIdx[sk.id] ?? sk.skill_order)
                            return (
                              <button
                                key={sk.id}
                                onClick={() => noteAc.insertToken(`[s:${sinnerName}:${sk.skill_order}]`)}
                                title={`${identity.name_kr} 스킬 ${sk.skill_order}`}
                                style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#0d0a06', cursor: 'pointer', flexShrink: 0, padding: 0 }}
                              >
                                {iconUrl && <Image src={iconUrl} alt="" width={24} height={24} />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── 서포트 패시브 ── */}
              {(() => {
                const items = Object.values(deckSlots).filter((id): id is Identity => !!id).flatMap(identity =>
                  (passivesByIdentityId[identity.id] ?? []).filter(p => p.passive_type === 'support')
                )
                if (items.length === 0) return null
                return (
                  <div className="flex items-start gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ color: '#555570', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', paddingTop: '3px', minWidth: '36px', flexShrink: 0 }}>패시브</span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {items.map(p => {
                        const sinType = SIN_KR_TO_TYPE[p.sin_affinity!]
                        const sinColor = sinType ? SIN_COLORS[sinType] : '#667788'
                        return (
                          <button
                            key={p.id}
                            onClick={() => noteAc.insertToken(`[p:${p.name}]`)}
                            title={p.name}
                            className="flex items-center gap-1 px-2 py-0.5 rounded"
                            style={{ background: `${sinColor}18`, border: `1px solid ${sinColor}35`, cursor: 'pointer' }}
                          >
                            {sinType && <Image src={SIN_ICON_MAP[sinType]} alt="" width={10} height={10} />}
                            <span style={{ color: sinColor, fontSize: '0.6875rem', fontWeight: 600 }}>{p.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* ── E.G.O ── */}
              {(() => {
                const items = Object.values(deckSlots).filter((id): id is Identity => !!id).flatMap(identity => {
                  const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
                  return Object.values(egoSlots[identity.sinner_id] ?? {}).map(ego => ({ ego, sinnerName }))
                })
                if (items.length === 0) return null
                return (
                  <div className="flex items-start gap-3 px-4 py-2.5">
                    <span style={{ color: '#555570', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', paddingTop: '3px', minWidth: '36px', flexShrink: 0 }}>E.G.O</span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {items.map(({ ego, sinnerName }) => {
                        const gradeColor = GRADE_COLORS[ego.grade ?? ''] ?? '#667788'
                        return (
                          <button
                            key={ego.id}
                            onClick={() => noteAc.insertToken(`[e:${sinnerName}:${ego.name_kr || ego.name}]`)}
                            title={`${ego.name_kr || ego.name}`}
                            className="flex items-center gap-1 px-2 py-0.5 rounded"
                            style={{ background: `${gradeColor}18`, border: `1px solid ${gradeColor}35`, cursor: 'pointer' }}
                          >
                            {ego.image_url && (
                              <Image src={ego.image_url} alt="" width={14} height={14} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                            )}
                            <span style={{ color: gradeColor, fontSize: '0.5625rem', fontWeight: 600 }}>{ego.name_kr || ego.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* 편집 / 미리보기 영역 */}
      {descPreview ? (
        <div className="px-4 py-3" style={{ background: 'rgba(5,4,2,0.3)', minHeight: '80px' }}>
          <NoteRenderer
            text={description}
            skillLookup={skillTokenLookup}
            passiveLookup={passiveTokenLookup}
            egoLookup={egoTokenLookup}
            egoGiftLookup={egoGiftLookup}
          />
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <NoteAutocompleteDropdown
            suggestions={noteAc.suggestions}
            selectedIdx={noteAc.selectedIdx}
            onSelect={noteAc.select}
            onHover={noteAc.setSelectedIdx}
          />
          <textarea
            ref={textareaRef}
            placeholder="덱 운용 메모... 키워드/스킬/에고를 입력하면 자동완성됩니다"
            value={description}
            onChange={e => {
              setDescription(e.target.value)
              noteAc.onTextChange(e)
            }}
            onSelect={noteAc.onTextSelect}
            onKeyDown={noteAc.handleKeyDown}
            className="w-full px-4 py-4 text-sm outline-none resize-none"
            style={{ background: 'rgba(5,4,2,0.3)', color: '#c8c0b0', border: 'none', fontFamily: 'var(--font-body)', lineHeight: 1.8, display: 'block', minHeight: '220px' }}
            onFocus={e => (e.target.style.background = 'rgba(8,6,3,0.5)')}
            onBlur={e => {
              e.target.style.background = 'rgba(5,4,2,0.3)'
              setTimeout(() => noteAc.closeDropdown(), 150)
            }}
          />
        </div>
      )}
    </div>
  )
}

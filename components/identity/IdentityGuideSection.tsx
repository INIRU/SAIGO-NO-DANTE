'use client'

import { useState, useRef, useCallback } from 'react'
import { Swords, Pencil, X, Check, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { NoteRenderer, type NoteSkillEntry, type NoteEgoEntry, type NoteIdentityEntry, type NoteEgoGiftEntry, type NotePassiveEntry } from '@/components/decks/NoteChips'
import { useNoteAutocomplete, NoteAutocompleteDropdown, type AutocompleteSuggestion } from '@/components/notes/NoteAutocomplete'

export interface GuideData {
  id: string
  title: string
  content: string
  author_name: string | null
  updated_at: string
}

export interface GuideSectionProps {
  identityId: string
  initialGuides: GuideData[]
  canEditGuide?: boolean
  sinColor: string
  skillTokenLookup: Record<string, NoteSkillEntry>
  passiveLookup: Record<string, NotePassiveEntry>
  egoTokenLookup: Record<string, NoteEgoEntry>
  identityTokenLookup: Record<string, NoteIdentityEntry>
  egoGiftLookup: Record<string, NoteEgoGiftEntry>
  acPool: AutocompleteSuggestion[]
}

export function useGuideEditor(identityId: string, initialGuides: GuideData[]) {
  const [guides, setGuides] = useState<GuideData[]>(initialGuides)
  const [openGuideIds, setOpenGuideIds] = useState<Set<string>>(() => {
    const first = initialGuides[0]
    return first ? new Set([first.id]) : new Set()
  })
  const [editingGuideId, setEditingGuideId] = useState<string | null>(null)
  const [guideTitle, setGuideTitle] = useState('')
  const [guideContent, setGuideContent] = useState('')
  const [guideSaving, setGuideSaving] = useState(false)
  const guideTextareaRef = useRef<HTMLTextAreaElement>(null)

  const toggleGuide = useCallback((id: string) => {
    setOpenGuideIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const startEditGuide = useCallback((g: GuideData) => {
    setEditingGuideId(g.id)
    setGuideTitle(g.title)
    setGuideContent(g.content)
    setOpenGuideIds(prev => new Set(prev).add(g.id))
    setTimeout(() => guideTextareaRef.current?.focus(), 50)
  }, [])

  const startNewGuide = useCallback(() => {
    setEditingGuideId('new')
    setGuideTitle('')
    setGuideContent('')
    setTimeout(() => guideTextareaRef.current?.focus(), 50)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingGuideId(null)
    setGuideTitle('')
    setGuideContent('')
  }, [])

  const refreshGuides = useCallback(async () => {
    const res = await fetch(`/api/guides?identity_id=${identityId}`)
    const data = await res.json()
    setGuides(Array.isArray(data) ? data : [])
    return Array.isArray(data) ? data as GuideData[] : []
  }, [identityId])

  const handleGuideSave = useCallback(async () => {
    if (!guideTitle.trim() || !guideContent.trim()) return
    setGuideSaving(true)
    try {
      if (editingGuideId === 'new') {
        await fetch('/api/guides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity_id: identityId, title: guideTitle, content: guideContent }),
        })
      } else {
        await fetch(`/api/guides/${editingGuideId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: guideTitle, content: guideContent }),
        })
      }
      const updated = await refreshGuides()
      if (editingGuideId === 'new' && updated.length > 0) {
        const newest = updated[updated.length - 1]
        setOpenGuideIds(prev => new Set(prev).add(newest.id))
      }
      setEditingGuideId(null)
      setGuideTitle('')
      setGuideContent('')
    } finally {
      setGuideSaving(false)
    }
  }, [editingGuideId, guideTitle, guideContent, identityId, refreshGuides])

  const handleGuideDelete = useCallback(async (guideId: string) => {
    if (!confirm('이 운영법을 삭제하시겠습니까?')) return
    await fetch(`/api/guides/${guideId}`, { method: 'DELETE' })
    await refreshGuides()
  }, [refreshGuides])

  return {
    guides,
    openGuideIds,
    editingGuideId,
    guideTitle,
    setGuideTitle,
    guideContent,
    setGuideContent,
    guideSaving,
    guideTextareaRef,
    toggleGuide,
    startEditGuide,
    startNewGuide,
    cancelEdit,
    handleGuideSave,
    handleGuideDelete,
  }
}

export default function IdentityGuideSection({
  identityId,
  initialGuides,
  canEditGuide,
  sinColor,
  skillTokenLookup,
  passiveLookup,
  egoTokenLookup,
  identityTokenLookup,
  egoGiftLookup,
  acPool,
}: GuideSectionProps) {
  const {
    guides,
    openGuideIds,
    editingGuideId,
    guideTitle,
    setGuideTitle,
    guideContent,
    setGuideContent,
    guideSaving,
    guideTextareaRef,
    toggleGuide,
    startEditGuide,
    startNewGuide,
    cancelEdit,
    handleGuideSave,
    handleGuideDelete,
  } = useGuideEditor(identityId, initialGuides)

  const ac = useNoteAutocomplete({
    text: guideContent,
    setText: setGuideContent,
    textareaRef: guideTextareaRef,
    pool: acPool,
  })

  const editorForm = (placeholder: string) => (
    <div className="relative">
      <NoteAutocompleteDropdown
        suggestions={ac.suggestions}
        selectedIdx={ac.selectedIdx}
        onSelect={ac.select}
        onHover={ac.setSelectedIdx}
      />
      <textarea
        ref={guideTextareaRef}
        value={guideContent}
        onChange={e => {
          setGuideContent(e.target.value)
          ac.onTextChange(e)
        }}
        onSelect={ac.onTextSelect}
        onKeyDown={ac.handleKeyDown}
        placeholder={placeholder}
        rows={8}
        className="w-full rounded p-3 text-sm resize-y"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border)',
          color: '#c8b89a',
          outline: 'none',
          lineHeight: 1.8,
        }}
      />
    </div>
  )

  const previewBlock = (
    <div className="mt-3 p-3 rounded" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
      <div style={{ color: '#999', fontSize: '0.75rem', marginBottom: '6px' }}>미리보기</div>
      <div style={{ color: '#b0a898', fontSize: '0.75rem', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
        <NoteRenderer
          text={guideContent}
          skillLookup={skillTokenLookup}
          passiveLookup={passiveLookup}
          egoLookup={egoTokenLookup}
          identityLookup={identityTokenLookup}
          egoGiftLookup={egoGiftLookup}
        />
      </div>
    </div>
  )

  const saveButtons = (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={handleGuideSave}
        disabled={guideSaving || !guideTitle.trim() || !guideContent.trim()}
        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
        style={{ background: sinColor, color: '#0d0b08', opacity: guideSaving || !guideTitle.trim() || !guideContent.trim() ? 0.4 : 1 }}
      >
        <Check size={12} />
        {guideSaving ? '저장 중...' : '저장'}
      </button>
      <button
        onClick={cancelEdit}
        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
        style={{ background: 'transparent', border: '1px solid var(--border)', color: '#aaa' }}
      >
        <X size={12} />
        취소
      </button>
    </div>
  )

  const titleInput = (placeholder: string) => (
    <input
      type="text"
      value={guideTitle}
      onChange={e => setGuideTitle(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded px-3 py-2 text-sm font-serif mb-3"
      style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid var(--border)',
        color: 'var(--gold)',
        outline: 'none',
      }}
    />
  )

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Swords size={16} style={{ color: 'var(--gold)' }} />
          <h2
            className="font-serif font-light"
            style={{ color: 'var(--gold)', fontSize: '1rem' }}
          >
            운영법
          </h2>
          {guides.length > 0 && (
            <span style={{ color: '#999', fontSize: '0.6875rem' }}>({guides.length})</span>
          )}
        </div>
        {canEditGuide && editingGuideId === null && (
          <button
            onClick={startNewGuide}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
            style={{
              background: 'rgba(200,144,10,0.1)',
              border: '1px solid var(--gold-dim)',
              color: 'var(--gold)',
            }}
          >
            <Plus size={12} />
            추가하기
          </button>
        )}
      </div>

      {/* 새 운영법 작성 폼 */}
      {editingGuideId === 'new' && (
        <div className="mb-4 p-4 pb-5 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
          {titleInput('운영법 제목을 입력하세요')}
          {editorForm('이 인격의 운영법을 작성하세요. 키워드/스킬/인격/에고 이름을 입력하면 자동완성됩니다.')}
          {guideContent.trim() && previewBlock}
          {saveButtons}
        </div>
      )}

      {/* 운영법 아코디언 목록 */}
      {guides.length > 0 ? (
        <div className="flex flex-col gap-2">
          {guides.map(g => {
            const isOpen = openGuideIds.has(g.id)
            const isEditing = editingGuideId === g.id
            return (
              <div key={g.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
                {/* 아코디언 헤더 */}
                <button
                  onClick={() => toggleGuide(g.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:brightness-110"
                  style={{ background: isOpen ? 'rgba(200,144,10,0.06)' : 'transparent' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronDown
                      size={14}
                      style={{
                        color: 'var(--gold-dim)',
                        transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.2s',
                        flexShrink: 0,
                      }}
                    />
                    <span className="font-serif text-sm truncate" style={{ color: 'var(--gold)' }}>
                      {g.title || '제목 없음'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {g.author_name && (
                      <span style={{ color: '#999', fontSize: '0.75rem' }}>
                        {g.author_name}
                      </span>
                    )}
                    {g.updated_at && (
                      <span style={{ color: '#999', fontSize: '0.75rem' }}>
                        {new Date(g.updated_at).toLocaleDateString('ko-KR')}
                      </span>
                    )}
                  </div>
                </button>

                {/* 아코디언 바디 */}
                {isOpen && (
                  <div className="px-4 pb-5" style={{ borderTop: '1px solid var(--border)' }}>
                    {isEditing ? (
                      <div className="pt-3">
                        {titleInput('운영법 제목')}
                        {editorForm('운영법 내용을 작성하세요.')}
                        {guideContent.trim() && previewBlock}
                        {saveButtons}
                      </div>
                    ) : (
                      <div className="pt-3">
                        <div style={{ color: '#b0a898', fontSize: '0.75rem', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                          <NoteRenderer
                            text={g.content}
                            skillLookup={skillTokenLookup}
                            passiveLookup={passiveLookup}
                            egoLookup={egoTokenLookup}
                            identityLookup={identityTokenLookup}
                            egoGiftLookup={egoGiftLookup}
                          />
                        </div>
                        {canEditGuide && editingGuideId === null && (
                          <div className="flex items-center gap-2 mt-5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                            <button
                              onClick={() => startEditGuide(g)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
                              style={{ background: 'rgba(200,144,10,0.1)', border: '1px solid var(--gold-dim)', color: 'var(--gold)' }}
                            >
                              <Pencil size={11} />
                              수정
                            </button>
                            <button
                              onClick={() => handleGuideDelete(g.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
                              style={{ background: 'rgba(200,50,50,0.1)', border: '1px solid rgba(200,50,50,0.3)', color: '#c85050' }}
                            >
                              <Trash2 size={11} />
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : editingGuideId !== 'new' && (
        <div className="text-center py-6" style={{ color: '#999' }}>
          <p className="text-sm italic">아직 운영법이 작성되지 않았습니다.</p>
          <a
            href="https://discord.com/users/340124004599988234"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded text-xs font-medium transition-all hover:brightness-110"
            style={{
              background: 'rgba(88,101,242,0.15)',
              border: '1px solid rgba(88,101,242,0.3)',
              color: '#7289da',
              fontFamily: 'var(--font-heading)',
            }}
          >
            운영법 작성 지원하기 (Discord)
          </a>
        </div>
      )}
    </div>
  )
}

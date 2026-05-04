'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { Bold, Check, ChevronDown, Heading2, Italic, Link2, List, ListOrdered, Pilcrow, Plus, Quote, Redo2, Undo2 } from 'lucide-react'
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TiptapLink from '@tiptap/extension-link'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  Passive,
  getSinnerLogoUrl,
  getIdentityInfoUrl,
  computeSkillImageIndices,
  STORAGE_BASE,
  SIN_COLORS,
  SinType,
  SIN_ICON_MAP,
  getSkillOrderLabel,
  getSkillIconUrl,
  type ActivationCondition,
} from '@/lib/data/sinners'
import {
  NoteRenderer,
  SkillChip,
  PassiveChip,
  EgoChip,
  type NoteSkillEntry,
  type NotePassiveEntry,
  type NoteEgoEntry,
  type NoteIdentityEntry,
  type NoteEgoGiftEntry,
} from '@/components/decks/NoteChips'
import {
  NoteAutocompleteDropdown,
  buildEgoGiftPool,
  buildKeywordPool,
  getNoteAutocompleteContext,
  getNoteAutocompleteSuggestions,
  useNoteAutocomplete,
  type AutocompleteSuggestion,
  type CaretAnchor,
} from '@/components/notes/NoteAutocomplete'
import SkillFrame from '@/components/identity/SkillFrame'
import GiftCard from '@/components/ui/GiftCard'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { localizeIdentityName } from '@/components/deck-detail/DeckIdentityCard'
import { getGiftActivationConditionStatus } from '@/lib/planner/gift-condition-status'
import { getDeckIdentityAffiliations } from '@/lib/decks/keyword-rules'
import type { SupportedLang } from '@/lib/i18n/types'

// 한국어 죄악명 → SinType
const SIN_KR_TO_TYPE: Record<string, SinType> = {
  '분노': 'wrath', '색욕': 'lust', '나태': 'sloth', '탐식': 'gluttony',
  '우울': 'gloom', '오만': 'pride', '질투': 'envy',
}

const MARKDOWN_TOOLS = [
  { label: '굵게', icon: Bold, action: 'bold' },
  { label: '기울임', icon: Italic, action: 'italic' },
  { label: '목록', icon: List, action: 'bulletList' },
  { label: '번호 목록', icon: ListOrdered, action: 'orderedList' },
  { label: '인용', icon: Quote, action: 'blockquote' },
  { label: '링크', icon: Link2, action: 'link' },
] as const

function PaletteLane({ children }: { children: ReactNode }) {
  return (
    <div className="deck-note-palette__tool-row">
      {children}
    </div>
  )
}

function getNoteSkillBaseOrder(skill: Skill): number {
  if (['evade', 'defense', 'counter'].includes(skill.skill_type)) return 4
  if (skill.skill_order >= 5) return 3
  return skill.skill_order
}

function getPassiveSinMeta(passive: Passive): { sinTypes: SinType[]; color: string } {
  const sinNames = passive.sin_affinity ? passive.sin_affinity.split(',').map(s => s.trim()) : []
  const sinTypes = sinNames.map(s => SIN_KR_TO_TYPE[s]).filter(Boolean) as SinType[]
  return {
    sinTypes,
    color: sinTypes[0] ? SIN_COLORS[sinTypes[0]] : '#667788',
  }
}

function normalizeSkillSin(sin?: string | null): SinType | 'wrath' {
  if (!sin) return 'wrath'
  if (sin in SIN_COLORS) return sin as SinType
  return SIN_KR_TO_TYPE[sin] ?? 'wrath'
}

function SmallSkillFrameButton({
  skill,
  sin,
  sinColor,
  skillIconUrl,
  label,
}: {
  skill: Skill
  sin: SinType
  sinColor: string
  skillIconUrl: string
  label: string
}) {
  const skillSlot = skill.skill_order >= 1 && skill.skill_order <= 3 ? skill.skill_order : 1
  return (
    <span className="deck-note-small-skill-frame">
      <SkillFrame
        skillIconUrl={skillIconUrl}
        sin={sin}
        skillSlot={skillSlot}
        sinColor={sinColor}
        label={label}
        size="2.75rem"
      />
    </span>
  )
}

function inlineMarkdownSegmentToContent(text: string): JSONContent[] {
  const nodes: JSONContent[] = []
  const inlineRe = /(\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|_[^_\n]+?_|`[^`\n]+?`)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > last) nodes.push({ type: 'text', text: text.slice(last, match.index) })
    const value = match[0]
    if (match[2] && match[3]) {
      nodes.push({ type: 'text', text: match[2], marks: [{ type: 'link', attrs: { href: match[3] } }] })
    } else if (value.startsWith('**')) {
      nodes.push({ type: 'text', text: value.slice(2, -2), marks: [{ type: 'bold' }] })
    } else if (value.startsWith('*') || value.startsWith('_')) {
      nodes.push({ type: 'text', text: value.slice(1, -1), marks: [{ type: 'italic' }] })
    } else {
      nodes.push({ type: 'text', text: value.slice(1, -1), marks: [{ type: 'code' }] })
    }
    last = match.index + value.length
  }

  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) })
  return nodes.length > 0 ? nodes : [{ type: 'text', text }]
}

function inlineMarkdownToContent(text: string): JSONContent[] {
  return inlineMarkdownSegmentToContent(text)
}

function markdownToTiptapContent(markdown: string): JSONContent {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const content: JSONContent[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      content.push({ type: 'paragraph' })
      i += 1
      continue
    }

    const heading = line.match(/^(#{1,2})\s+(.+)$/)
    if (heading) {
      content.push({
        type: 'heading',
        attrs: { level: heading[1].length },
        content: inlineMarkdownToContent(heading[2]),
      })
      i += 1
      continue
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      const quoteContent: JSONContent[] = []
      let j = i
      while (j < lines.length) {
        const next = lines[j].match(/^>\s?(.*)$/)
        if (!next) break
        quoteContent.push({ type: 'paragraph', content: inlineMarkdownToContent(next[1]) })
        j += 1
      }
      content.push({ type: 'blockquote', content: quoteContent })
      i = j
      continue
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/)
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/)
    if (unordered || ordered) {
      const orderedList = Boolean(ordered)
      const items: JSONContent[] = []
      let j = i
      while (j < lines.length) {
        const item = orderedList
          ? lines[j].match(/^\s*\d+\.\s+(.+)$/)
          : lines[j].match(/^\s*[-*]\s+(.+)$/)
        if (!item) break
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: inlineMarkdownToContent(item[1]) }],
        })
        j += 1
      }
      content.push({ type: orderedList ? 'orderedList' : 'bulletList', content: items })
      i = j
      continue
    }

    const paragraphLines = [line.trim()]
    let j = i + 1
    while (j < lines.length) {
      const next = lines[j]
      if (!next.trim()) break
      if (
        next.match(/^(#{1,2})\s+(.+)$/) ||
        next.match(/^>\s?(.*)$/) ||
        next.match(/^\s*[-*]\s+(.+)$/) ||
        next.match(/^\s*\d+\.\s+(.+)$/)
      ) {
        break
      }
      paragraphLines.push(next.trim())
      j += 1
    }
    content.push({ type: 'paragraph', content: inlineMarkdownToContent(paragraphLines.join(' ')) })
    i = j
  }

  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] }
}

function markText(text: string, marks?: JSONContent['marks']): string {
  if (!marks?.length) return text
  return marks.reduce((value, mark) => {
    if (mark.type === 'bold') return `**${value}**`
    if (mark.type === 'italic') return `*${value}*`
    if (mark.type === 'code') return `\`${value}\``
    if (mark.type === 'link') {
      const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : ''
      return href ? `[${value}](${href})` : value
    }
    return value
  }, text)
}

function inlineContentToMarkdown(node?: JSONContent): string {
  return (node?.content ?? []).map(child => {
    if (child.type === 'text') return markText(child.text ?? '', child.marks)
    if (child.content) return inlineContentToMarkdown(child)
    return ''
  }).join('')
}

function tiptapContentToMarkdown(doc: JSONContent): string {
  return (doc.content ?? []).map(node => {
    if (node.type === 'heading') {
      const level = node.attrs?.level === 1 ? '#' : '##'
      return `${level} ${inlineContentToMarkdown(node)}`
    }
    if (node.type === 'paragraph') return inlineContentToMarkdown(node)
    if (node.type === 'blockquote') {
      return (node.content ?? []).map(child => `> ${inlineContentToMarkdown(child)}`).join('\n')
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      return (node.content ?? []).map((item, index) => {
        const body = (item.content ?? []).map(child => inlineContentToMarkdown(child)).join(' ')
        return node.type === 'orderedList' ? `${index + 1}. ${body}` : `- ${body}`
      }).join('\n')
    }
    if (node.type === 'codeBlock') return `\`\`\`\n${inlineContentToMarkdown(node)}\n\`\`\``
    return inlineContentToMarkdown(node)
  }).join('\n')
}

function isEditorToolActive(editor: Editor, action: typeof MARKDOWN_TOOLS[number]['action']): boolean {
  if (action === 'bulletList') return editor.isActive('bulletList')
  if (action === 'orderedList') return editor.isActive('orderedList')
  if (action === 'blockquote') return editor.isActive('blockquote')
  if (action === 'link') return editor.isActive('link')
  return editor.isActive(action)
}

interface Props {
  sinners: Sinner[]
  identities: Identity[]
  deckSlots: Record<string, Identity | undefined>
  egoSlots: Record<string, Record<string, EGO>>
  skillsByIdentityId: Record<string, Skill[]>
  passivesByIdentityId: Record<string, Passive[]>
  egoGifts: {
    name: string
    keyword: string
    grade: string
    image_url: string | null
    effect_base: string | null
    activation_condition: ActivationCondition | null
  }[]
  formationOrder: string[]
  formationGiftKeywordCounts: Record<string, number>
  allGiftKeywordCounts: Record<string, number>
  locale: SupportedLang
  description: string
  setDescription: (v: string) => void
  descPreview: boolean
  setDescPreview: (v: boolean | ((prev: boolean) => boolean)) => void
}

function HeadingDropdown({
  editor,
  onSelect,
}: {
  editor: Editor | null
  onSelect: (type: 'paragraph' | 'heading2') => void
}) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const currentType = editor?.isActive('heading', { level: 2 }) ? 'heading2' : 'paragraph'
  const currentLabel = currentType === 'heading2' ? '제목' : '문단'
  const options = [
    { value: 'paragraph' as const, label: '문단', display: 'p', icon: Pilcrow },
    { value: 'heading2' as const, label: '제목', display: 'h2', icon: Heading2 },
  ]

  const handleSelect = (type: 'paragraph' | 'heading2') => {
    onSelect(type)
    setOpen(false)
  }

  const updateMenuPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuPosition({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 160),
    })
  }, [])

  const toggleOpen = () => {
    if (!open) updateMenuPosition()
    setOpen(value => !value)
  }

  useEffect(() => {
    if (!open) return
    updateMenuPosition()

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, updateMenuPosition])

  const menu = open && menuPosition && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        className="deck-note-heading-menu"
        role="menu"
        aria-label="문단 형식"
        style={{
          position: 'fixed',
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
        }}
      >
        {options.map(({ value, label, display, icon: Icon }) => {
          const active = value === currentType
          return (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              className="deck-note-heading-menu__item"
              data-active={active || undefined}
              onClick={() => handleSelect(value)}
            >
              <span className="deck-note-heading-menu__display">{display}</span>
              <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
              {active && <Check size={14} strokeWidth={1.8} aria-hidden="true" />}
            </button>
          )
        })}
      </div>,
      document.body,
    )
    : null

  return (
    <div className="deck-note-heading-dropdown">
      <button
        ref={buttonRef}
        type="button"
        className="deck-note-rte__heading-button"
        aria-label="문단 형식"
        aria-haspopup="menu"
        aria-expanded={open}
        title="문단 형식"
        disabled={!editor}
        onClick={toggleOpen}
        onKeyDown={event => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        {currentType === 'heading2'
          ? <Heading2 size={16} strokeWidth={1.8} aria-hidden="true" />
          : <Pilcrow size={16} strokeWidth={1.8} aria-hidden="true" />}
        <span className="deck-note-rte__heading-label">{currentLabel}</span>
        <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" data-open={open || undefined} />
      </button>
      {menu}
    </div>
  )
}

export default function DeckNoteEditor({
  sinners, identities, deckSlots, egoSlots,
  skillsByIdentityId, passivesByIdentityId,
  egoGifts, formationOrder, formationGiftKeywordCounts, allGiftKeywordCounts, locale,
  description, setDescription,
  descPreview, setDescPreview,
}: Props) {
  const { keywords: kwContext } = useKeywordData()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [editorSuggestions, setEditorSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [editorSelectedIdx, setEditorSelectedIdx] = useState(-1)
  const [editorAnchor, setEditorAnchor] = useState<CaretAnchor | null>(null)
  const editorComposingRef = useRef(false)
  const [selectedSinnerId, setSelectedSinnerId] = useState<string | null>(null)
  const [insertOpen, setInsertOpen] = useState(false)
  const editorContent = useMemo(() => markdownToTiptapContent(description), [description])
  const selectedSinner = selectedSinnerId ? sinners.find(sinner => sinner.id === selectedSinnerId) : undefined
  const selectedIdentity = selectedSinnerId ? deckSlots[selectedSinnerId] : undefined
  const selectedSkills = selectedIdentity ? (skillsByIdentityId[selectedIdentity.id] ?? []) : []
  const selectedPassives = selectedIdentity ? (passivesByIdentityId[selectedIdentity.id] ?? []) : []
  const selectedEgos = selectedSinnerId ? Object.values(egoSlots[selectedSinnerId] ?? {}) : []
  const selectedIdentityImageUrl = selectedIdentity ? getIdentityInfoUrl(selectedIdentity) : ''
  const selectedSkillImageIndices = useMemo(() => computeSkillImageIndices(selectedSkills), [selectedSkills])

  const skillTokenLookup = useMemo(() => {
    const map: Record<string, NoteSkillEntry> = {}
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      const idSkills = skillsByIdentityId[identity.id] ?? []
      const imgIdx = computeSkillImageIndices(idSkills)
      const orderCount: Record<number, number> = {}
      for (const sk of idSkills) {
        const baseOrder = getNoteSkillBaseOrder(sk)
        const subIdx = orderCount[baseOrder] || 0
        orderCount[baseOrder] = subIdx + 1
        const key = subIdx === 0
          ? `${sinnerName}:${baseOrder}`
          : `${sinnerName}:${baseOrder}:${subIdx + 1}`
        const entry = {
          name: sk.name,
          skill_type: sk.skill_type,
          sin_affinity: sk.sin_affinity as string,
          skill_order: sk.skill_order,
          description: sk.description,
          iconUrl: getSkillIconUrl(identity, imgIdx[sk.id] ?? sk.skill_order),
          identityName: identity.name_kr,
          sinnerName,
          skill: sk,
          skills: idSkills,
          identity: { sinner_id: identity.sinner_id, game_id: identity.game_id },
        }
        map[key] = entry
        if (subIdx === 1) map[`${sinnerName}:${baseOrder}:1`] = entry
        if (sk.skill_order !== baseOrder) map[`${sinnerName}:${sk.skill_order}`] = entry
      }
    }
    return map
  }, [deckSlots, skillsByIdentityId, sinners])

  const passiveTokenLookup = useMemo(() => {
    const map: Record<string, NotePassiveEntry> = {}
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      for (const p of passivesByIdentityId[identity.id] ?? []) {
        map[p.name] = {
          name: p.name,
          sin_affinity: p.sin_affinity,
          sin_count: p.sin_count,
          active_cond: p.active_cond,
          description: p.description,
          sinnerName,
          imageUrl: getIdentityInfoUrl(identity) || undefined,
        }
      }
    }
    return map
  }, [deckSlots, passivesByIdentityId, sinners])

  const egoTokenLookup = useMemo(() => {
    const map: Record<string, NoteEgoEntry> = {}
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      for (const ego of Object.values(egoSlots[identity.sinner_id] ?? {})) {
        const name = ego.name_kr || ego.name
        map[`${sinnerName}:${name}`] = {
          name,
          grade: ego.grade,
          sin_affinity: ego.sin_affinity,
          image_url: ego.image_url,
          sinnerName,
        }
      }
    }
    return map
  }, [deckSlots, egoSlots, sinners])

  const identityLookup = useMemo(() => {
    const map: Record<string, NoteIdentityEntry> = {}
    for (const identity of identities) {
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      map[`${sinnerName}:${identity.name_kr}`] = {
        name: localizeIdentityName(identity, locale),
        rarity: identity.rarity,
        imageUrl: getIdentityInfoUrl(identity) || undefined,
        sinnerName,
        keywords: identity.keywords,
      }
    }
    return map
  }, [identities, locale, sinners])

  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const g of egoGifts) {
      map[g.name] = {
        name: g.name,
        keyword: g.keyword,
        grade: g.grade,
        image_url: g.image_url,
        effect_base: g.effect_base,
        activation_condition: g.activation_condition,
      }
    }
    return map
  }, [egoGifts])

  const egoGiftConditionLookup = useMemo(() => {
    const formationAffiliationCounts: Record<string, number> = {}
    const allAffiliationCounts: Record<string, number> = {}
    const activeFormationIds = new Set(formationOrder.slice(0, 7))
    const assignedIds = new Set(formationOrder)

    for (const [sinnerId, identity] of Object.entries(deckSlots)) {
      if (!identity) continue
      const affiliations = getDeckIdentityAffiliations(identity)
      if (activeFormationIds.has(sinnerId)) {
        for (const affiliation of affiliations) {
          formationAffiliationCounts[affiliation] = (formationAffiliationCounts[affiliation] ?? 0) + 1
        }
      }
      if (assignedIds.has(sinnerId)) {
        for (const affiliation of affiliations) {
          allAffiliationCounts[affiliation] = (allAffiliationCounts[affiliation] ?? 0) + 1
        }
      }
    }

    const map: Record<string, ReturnType<typeof getGiftActivationConditionStatus>> = {}
    for (const gift of egoGifts) {
      map[gift.name] = getGiftActivationConditionStatus({
        gift,
        formationKeywordCounts: formationGiftKeywordCounts,
        allKeywordCounts: allGiftKeywordCounts,
        formationAffiliationCounts,
        allAffiliationCounts,
      })
    }
    return map
  }, [allGiftKeywordCounts, deckSlots, egoGifts, formationGiftKeywordCounts, formationOrder])

  const noteAcPool = useMemo((): AutocompleteSuggestion[] => {
    const pool: AutocompleteSuggestion[] = []
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      const idSkills = skillsByIdentityId[identity.id] ?? []
      const imgIdx = computeSkillImageIndices(idSkills)
      const acOrderCount: Record<number, number> = {}
      for (const sk of idSkills) {
        const baseOrder = getNoteSkillBaseOrder(sk)
        const subIdx = acOrderCount[baseOrder] || 0
        acOrderCount[baseOrder] = subIdx + 1
        const sc = SIN_COLORS[sk.sin_affinity] || '#888'
        const orderLabel = subIdx === 0 ? getSkillOrderLabel(baseOrder, sk.skill_type) : `${getSkillOrderLabel(baseOrder, sk.skill_type)}-${subIdx + 1}`
        const token = subIdx === 0
          ? `[s:${sinnerName}:${baseOrder}]`
          : `[s:${sinnerName}:${baseOrder}:${subIdx + 1}]`
        pool.push({
          label: `${orderLabel} ${sk.name}`,
          type: 'skill',
          typeLabel: '스킬',
          color: sc,
          iconUrl: getSkillIconUrl(identity, imgIdx[sk.id] ?? sk.skill_order),
          token,
          syntax: 'inline',
        })
        pool.push({
          label: `${sinnerName} ${orderLabel} ${sk.name}`,
          type: 'skill',
          typeLabel: '스킬 프레임',
          color: sc,
          iconUrl: getSkillIconUrl(identity, imgIdx[sk.id] ?? sk.skill_order),
          token: subIdx === 0
            ? `{{skill:${sinnerName}:${baseOrder}}}`
            : `{{skill:${sinnerName}:${baseOrder}:${subIdx + 1}}}`,
          syntax: 'block',
        })
      }
    }
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      for (const p of passivesByIdentityId[identity.id] ?? []) {
        const sinEn = p.sin_affinity ? (SIN_COLORS as Record<string, string>)[p.sin_affinity] : undefined
        pool.push({
          label: p.name,
          type: 'passive',
          typeLabel: '패시브',
          color: sinEn || '#88a830',
          token: `[p:${p.name}]`,
          syntax: 'inline',
        })
        pool.push({
          label: p.name,
          type: 'passive',
          typeLabel: '패시브 설명',
          color: sinEn || '#88a830',
          token: `{{passive:${p.name}}}`,
          syntax: 'block',
        })
      }
    }
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      for (const ego of Object.values(egoSlots[identity.sinner_id] ?? {})) {
        const name = ego.name_kr || ego.name
        const sc = ego.sin_affinity ? (SIN_COLORS[ego.sin_affinity] ?? '#c8900a') : '#c8900a'
        pool.push({
          label: name,
          type: 'ego',
          typeLabel: 'E.G.O',
          color: sc,
          imageUrl: ego.image_url ?? undefined,
          token: `[e:${sinnerName}:${name}]`,
          syntax: 'inline',
        })
      }
    }
    for (const identity of identities) {
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      pool.push({
        label: localizeIdentityName(identity, locale),
        type: 'identity',
        typeLabel: '인격',
        color: '#c8900a',
        imageUrl: getIdentityInfoUrl(identity) || undefined,
        token: `[i:${sinnerName}:${identity.name_kr}]`,
        syntax: 'inline',
      })
    }
    pool.push(...buildKeywordPool(kwContext))
    pool.push(...buildEgoGiftPool(egoGifts))
    for (const gift of egoGifts) {
      pool.push({
        label: gift.name,
        type: 'egogift',
        typeLabel: '기프트 카드',
        color: '#d0a020',
        imageUrl: gift.image_url ?? undefined,
        token: gift.activation_condition ? `{{gift:${gift.name}:true}}` : `{{gift:${gift.name}}}`,
        syntax: 'block',
      })
    }
    return pool
  }, [deckSlots, egoSlots, egoGifts, identities, kwContext, locale, passivesByIdentityId, sinners, skillsByIdentityId])

  const noteAc = useNoteAutocomplete({
    text: description,
    setText: setDescription,
    textareaRef,
    pool: noteAcPool,
  })

  useEffect(() => {
    if (selectedSinnerId && !sinners.some(sinner => sinner.id === selectedSinnerId)) {
      setSelectedSinnerId(null)
    }
  }, [selectedSinnerId, sinners])

  const refreshEditorAutocompleteFromView = useCallback((state: Editor['state'], view: Editor['view']) => {
    if (editorComposingRef.current) {
      setEditorSuggestions([])
      setEditorAnchor(null)
      return
    }
    const { selection } = state
    if (!selection.empty) {
      setEditorSuggestions([])
      setEditorAnchor(null)
      return
    }
    const textBefore = selection.$from.parent.textBetween(0, selection.$from.parentOffset, '\n')
    const nextSuggestions = getNoteAutocompleteSuggestions(textBefore, textBefore.length, noteAc.pool)
    setEditorSuggestions(nextSuggestions)
    setEditorSelectedIdx(-1)
    if (nextSuggestions.length === 0) {
      setEditorAnchor(null)
      return
    }
    const coords = view.coordsAtPos(selection.from)
    const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize || '16')
    setEditorAnchor({
      left: coords.left,
      top: coords.bottom + 6,
      width: 17.5 * rootFontSize,
    })
  }, [noteAc.pool])

  const refreshEditorAutocomplete = useCallback((editor: Editor) => {
    refreshEditorAutocompleteFromView(editor.state, editor.view)
  }, [refreshEditorAutocompleteFromView])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Placeholder.configure({
        placeholder: '덱 운용 메모를 작성하세요. [ 또는 {{ 로 칩과 블록을 삽입할 수 있습니다.',
      }),
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    ],
    content: editorContent,
    editorProps: {
      attributes: {
        'aria-label': '덱 노트',
        class: 'deck-note-prosemirror',
      },
      handleDOMEvents: {
        compositionstart: () => {
          editorComposingRef.current = true
          setEditorSuggestions([])
          setEditorAnchor(null)
          return false
        },
        compositionend: view => {
          editorComposingRef.current = false
          requestAnimationFrame(() => {
            if (!editorComposingRef.current) refreshEditorAutocompleteFromView(view.state, view)
          })
          return false
        },
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      setDescription(tiptapContentToMarkdown(nextEditor.getJSON()))
      refreshEditorAutocomplete(nextEditor)
    },
    onSelectionUpdate: ({ editor: nextEditor }) => {
      refreshEditorAutocomplete(nextEditor)
    },
  }, [refreshEditorAutocomplete, refreshEditorAutocompleteFromView])

  useEffect(() => {
    editor?.setEditable(!descPreview)
  }, [descPreview, editor])

  useEffect(() => {
    if (!editor) return
    const currentMarkdown = tiptapContentToMarkdown(editor.getJSON())
    if (currentMarkdown !== description) {
      editor.commands.setContent(markdownToTiptapContent(description), { emitUpdate: false })
      refreshEditorAutocomplete(editor)
    }
  }, [description, editor, refreshEditorAutocomplete])

  const runEditorTool = useCallback((action: typeof MARKDOWN_TOOLS[number]['action']) => {
    if (!editor || descPreview) return
    const chain = editor.chain().focus()
    if (action === 'bold') chain.toggleBold().run()
    else if (action === 'italic') chain.toggleItalic().run()
    else if (action === 'bulletList') chain.toggleBulletList().run()
    else if (action === 'orderedList') chain.toggleOrderedList().run()
    else if (action === 'blockquote') chain.toggleBlockquote().run()
    else if (action === 'link') {
      const selectedText = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
      if (selectedText.trim()) {
        chain.toggleLink({ href: 'https://' }).run()
      } else {
        chain.insertContent('[링크](https://)').run()
      }
    }
  }, [descPreview, editor])

  const setEditorBlockType = useCallback((type: 'paragraph' | 'heading2') => {
    if (!editor || descPreview) return
    const chain = editor.chain().focus()
    if (type === 'paragraph') chain.setParagraph().run()
    else chain.toggleHeading({ level: 2 }).run()
  }, [descPreview, editor])

  const runHistoryTool = useCallback((direction: 'undo' | 'redo') => {
    if (!editor || descPreview) return
    if (direction === 'undo') editor.chain().focus().undo().run()
    else editor.chain().focus().redo().run()
  }, [descPreview, editor])

  const insertEditorToken = useCallback((token: string) => {
    if (descPreview) return
    if (!editor) {
      noteAc.insertToken(token)
      return
    }
    editor.chain().focus().insertContent(token).run()
    setEditorSuggestions([])
    setEditorAnchor(null)
  }, [descPreview, editor, noteAc])

  const selectEditorSuggestion = useCallback((sugg: AutocompleteSuggestion) => {
    if (editorComposingRef.current) return
    if (!editor || descPreview) return
    const { selection } = editor.state
    const textBefore = selection.$from.parent.textBetween(0, selection.$from.parentOffset, '\n')
    const context = getNoteAutocompleteContext(textBefore, textBefore.length)
    if (context.mode === 'closed' || context.mode === 'word') return
    const from = selection.$from.start() + context.replaceStart
    const to = selection.$from.start() + context.replaceEnd
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    editor.chain().focus(undefined, { scrollIntoView: false }).deleteRange({ from, to }).insertContent(sugg.token).run()
    requestAnimationFrame(() => {
      editor.commands.focus(undefined, { scrollIntoView: false })
      window.scrollTo(scrollX, scrollY)
      refreshEditorAutocomplete(editor)
    })
    if (!sugg.token.endsWith(':')) {
      setEditorSuggestions([])
      setEditorAnchor(null)
    }
  }, [descPreview, editor, refreshEditorAutocomplete])

  const handleEditorKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const maybeComposingEvent = event as KeyboardEvent<HTMLDivElement> & { isComposing?: boolean }
    if (maybeComposingEvent.isComposing || event.nativeEvent.isComposing || editorComposingRef.current) {
      if (event.key === 'Tab') {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    }
    if (editorSuggestions.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setEditorSelectedIdx(idx => Math.min(idx + 1, editorSuggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setEditorSelectedIdx(idx => Math.max(idx - 1, 0))
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      if (event.key === 'Tab') event.stopPropagation()
      selectEditorSuggestion(editorSuggestions[Math.max(editorSelectedIdx, 0)])
    } else if (event.key === 'Escape') {
      setEditorSuggestions([])
      setEditorAnchor(null)
    }
  }, [editorSelectedIdx, editorSuggestions, selectEditorSuggestion])

  return (
    <div
      className="deck-note-rte"
      style={{
        position: 'relative',
        overflow: 'visible',
        border: '1px solid rgba(200,144,10,0.18)',
        borderRadius: '0.5rem',
        background: '#0f0d0a',
      }}
    >
      <div className="deck-note-rte__container">
        <div className="deck-note-rte__menubar">
          <div className="deck-note-rte__toolbar" role="toolbar" aria-label="덱 노트 편집 도구">
            <div className="deck-note-rte__group" role="group" aria-label="히스토리">
              <button type="button" className="deck-note-rte__button" aria-label="되돌리기" title="되돌리기" onClick={() => runHistoryTool('undo')} disabled={descPreview || !editor?.can().undo()}>
                <Undo2 size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button type="button" className="deck-note-rte__button" aria-label="다시 실행" title="다시 실행" onClick={() => runHistoryTool('redo')} disabled={descPreview || !editor?.can().redo()}>
                <Redo2 size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>

            <div className="deck-note-rte__divider" />

            <div className="deck-note-rte__group" role="group" aria-label="문단">
              <HeadingDropdown editor={descPreview ? null : editor} onSelect={setEditorBlockType} />
            </div>

            <div className="deck-note-rte__divider" />

            <div className="deck-note-rte__group" role="group" aria-label="서식">
              {MARKDOWN_TOOLS.map(({ label, icon: Icon, action }) => {
                const active = editor ? isEditorToolActive(editor, action) : false
                return (
                  <button
                    key={label}
                    type="button"
                    aria-label={label}
                    aria-pressed={active}
                    title={label}
                    onClick={() => runEditorTool(action)}
                    className="deck-note-rte__button"
                    data-active={active || undefined}
                    disabled={descPreview}
                  >
                    <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                )
              })}
            </div>

            <div className="deck-note-rte__spacer" />

            <div className="deck-note-rte__group" role="group" aria-label="삽입과 미리보기">
              <button
                type="button"
                className="deck-note-rte__insert-button"
                aria-expanded={insertOpen}
                aria-controls="deck-note-insert-panel"
                onClick={() => setInsertOpen(value => !value)}
              >
                <Plus size={15} strokeWidth={1.8} aria-hidden="true" />
                <span>삽입</span>
              </button>
              <button
                type="button"
                className="deck-note-preview-toggle"
                aria-pressed={descPreview}
                onClick={() => setDescPreview(prev => !prev)}
              >
                <span className="deck-note-preview-toggle__track" aria-hidden="true">
                  <span className="deck-note-preview-toggle__thumb" />
                </span>
                <span>{descPreview ? '미리보기' : '편집'}</span>
              </button>
            </div>
          </div>

          {insertOpen && (
          <div id="deck-note-insert-panel" className="deck-note-sinner-tool">
            <div className="deck-note-sinner-tabs" role="tablist" aria-label="수감자 삽입 도구">
              {sinners.map(sinner => {
                const isSelected = selectedSinnerId === sinner.id
                const isDeckMember = Boolean(deckSlots[sinner.id])
                return (
                  <button
                    key={sinner.id}
                    type="button"
                    role="tab"
                    aria-label={`${sinner.name_kr} 삽입 팔레트`}
                    aria-selected={isSelected}
                    onClick={() => setSelectedSinnerId(current => current === sinner.id ? null : sinner.id)}
                    className="deck-note-sinner-tab"
                    data-selected={isSelected || undefined}
                    data-muted={!isDeckMember || undefined}
                    title={sinner.name_kr}
                  >
                    <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={22} height={22} style={{ width: '1.375rem', height: '1.375rem', objectFit: 'contain' }} unoptimized />
                  </button>
                )
              })}
            </div>

            <div className="deck-note-palette">
              {!selectedSinner || !selectedIdentity ? (
                <span className="deck-note-palette__hint">
                  수감자를 선택하면 편성된 인격, 스킬, 패시브, E.G.O 삽입 도구가 열립니다
                </span>
              ) : (
                <div className="deck-note-palette__lanes">
                  <div className="deck-note-palette__lane">
                    <PaletteLane>
                      <button
                        type="button"
                        aria-label={`${selectedIdentity.name_kr} 인격 칩 삽입`}
                        title={selectedIdentity.name_kr}
                        className="deck-note-identity-avatar"
                        disabled={descPreview}
                        onClick={() => insertEditorToken(`[i:${selectedSinner.name_kr}:${selectedIdentity.name_kr}]`)}
                      >
                        {selectedIdentityImageUrl ? (
                          <Image src={selectedIdentityImageUrl} alt="" width={44} height={44} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                        ) : (
                          <Image src={getSinnerLogoUrl(selectedSinner.id)} alt="" width={24} height={24} style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain' }} unoptimized />
                        )}
                      </button>

                      {selectedSkills.map(sk => {
                        const sameBaseBefore = selectedSkills
                          .slice(0, selectedSkills.findIndex(item => item.id === sk.id) + 1)
                          .filter(item => getNoteSkillBaseOrder(item) === getNoteSkillBaseOrder(sk)).length
                        const baseOrder = getNoteSkillBaseOrder(sk)
                        const variant = sameBaseBefore - 1
                        const token = variant === 0
                          ? `{{skill:${selectedSinner.name_kr}:${baseOrder}}}`
                          : `{{skill:${selectedSinner.name_kr}:${baseOrder}:${variant + 1}}}`
                        const orderLabel = variant === 0 ? getSkillOrderLabel(baseOrder, sk.skill_type) : `${getSkillOrderLabel(baseOrder, sk.skill_type)}-${variant + 1}`
                        const sin = normalizeSkillSin(sk.sin_affinity)
                        const sinColor = SIN_COLORS[sin]
                        const imageIndex = selectedSkillImageIndices[sk.id] ?? sk.skill_order
                        const skillIconUrl = selectedIdentity.game_id
                          ? `${STORAGE_BASE}/icons/skills/${selectedIdentity.sinner_id}/${selectedIdentity.game_id}${String(imageIndex).padStart(2, '0')}.webp`
                          : ''
                        return (
                          <button
                            key={sk.id}
                            type="button"
                            aria-label={`${orderLabel} ${sk.name} 상세 블록 삽입`}
                            title={`${orderLabel} ${sk.name}`}
                            className="deck-note-skill-frame-button"
                            disabled={descPreview}
                            onClick={() => insertEditorToken(token)}
                          >
                            <SmallSkillFrameButton
                              skill={sk}
                              sin={sin}
                              sinColor={sinColor}
                              skillIconUrl={skillIconUrl}
                              label={orderLabel}
                            />
                          </button>
                        )
                      })}

                      {selectedPassives.map(passive => {
                        const meta = getPassiveSinMeta(passive)
                        const entry = passiveTokenLookup[passive.name]
                        return (
                          <button
                            key={passive.id}
                            type="button"
                            aria-label={`${passive.name} 상세 설명 삽입`}
                            title={`${passive.name} 설명`}
                            className={entry ? 'deck-note-chip-button' : 'deck-note-passive-icon-button'}
                            style={{ '--note-passive-color': meta.color } as CSSProperties}
                            disabled={descPreview}
                            onMouseDown={event => { event.preventDefault(); insertEditorToken(`{{passive:${passive.name}}}`) }}
                          >
                            {entry ? (
                              <PassiveChip entry={entry} interactive={false} />
                            ) : (
                              <span className="deck-note-passive-detail-button__icons">
                                {meta.sinTypes.map((sinType, index) => (
                                  <Image key={`${sinType}-${index}`} src={SIN_ICON_MAP[sinType]} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem' }} />
                                ))}
                              </span>
                            )}
                          </button>
                        )
                      })}

                      <GiftCard
                        gift={{ name: '기프트 추가' }}
                        onClick={() => insertEditorToken('{{gift:')}
                        className="deck-note-gift-template-button"
                        variant="insert"
                        ariaLabel="기프트 추가"
                        title="기프트 토큰 시작"
                        size="2.25rem"
                        showName={false}
                        disabled={descPreview}
                      />
                    </PaletteLane>
                  </div>

                  <div className="deck-note-palette__lane">
                    <PaletteLane>
                      {selectedSkills.map(sk => {
                        const sameBaseBefore = selectedSkills
                          .slice(0, selectedSkills.findIndex(item => item.id === sk.id) + 1)
                          .filter(item => getNoteSkillBaseOrder(item) === getNoteSkillBaseOrder(sk)).length
                        const baseOrder = getNoteSkillBaseOrder(sk)
                        const variant = sameBaseBefore - 1
                        const key = variant === 0
                          ? `${selectedSinner.name_kr}:${baseOrder}`
                          : `${selectedSinner.name_kr}:${baseOrder}:${variant + 1}`
                        const entry = skillTokenLookup[key] ?? skillTokenLookup[`${key}:1`]
                        return entry ? (
                          <button
                            key={sk.id}
                            type="button"
                            className="deck-note-chip-button"
                            title={`${entry.name} 칩`}
                            disabled={descPreview}
                            onMouseDown={event => { event.preventDefault(); insertEditorToken(`[s:${key}]`) }}
                          >
                            <SkillChip entry={entry} interactive={false} />
                          </button>
                        ) : null
                      })}

                      {selectedPassives.map(passive => {
                        const entry = passiveTokenLookup[passive.name]
                        return entry ? (
                          <button
                            key={passive.id}
                            type="button"
                            className="deck-note-chip-button"
                            title={`${entry.name} 칩`}
                            disabled={descPreview}
                            onMouseDown={event => { event.preventDefault(); insertEditorToken(`[p:${passive.name}]`) }}
                          >
                            <PassiveChip entry={entry} interactive={false} />
                          </button>
                        ) : null
                      })}

                      {selectedEgos.map(ego => {
                        const egoName = ego.name_kr || ego.name
                        const key = `${selectedSinner.name_kr}:${egoName}`
                        const entry = egoTokenLookup[key] ?? {
                          name: egoName,
                          grade: ego.grade ?? '',
                          sin_affinity: ego.sin_affinity,
                          image_url: ego.image_url,
                          sinnerName: selectedSinner.name_kr,
                        }
                        return (
                          <button
                            key={ego.id}
                            type="button"
                            disabled={descPreview}
                            onMouseDown={event => { event.preventDefault(); insertEditorToken(`[e:${key}]`) }}
                            title={`${egoName} 칩`}
                            className="deck-note-chip-button"
                          >
                            <EgoChip entry={entry} interactive={false} />
                          </button>
                        )
                      })}

                    </PaletteLane>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        <div className="deck-note-rte__content">
          {descPreview ? (
            <div className="deck-note-preview" aria-label="덱 노트 미리보기">
              <NoteRenderer
                text={description}
                skillLookup={skillTokenLookup}
                passiveLookup={passiveTokenLookup}
                egoLookup={egoTokenLookup}
                identityLookup={identityLookup}
                egoGiftLookup={egoGiftLookup}
                egoGiftConditionLookup={egoGiftConditionLookup}
              />
            </div>
          ) : (
            <>
              <NoteAutocompleteDropdown
                suggestions={editorSuggestions}
                selectedIdx={editorSelectedIdx}
                onSelect={selectEditorSuggestion}
                onHover={setEditorSelectedIdx}
                anchor={editorAnchor}
              />
              <EditorContent editor={editor} className="deck-note-editor-content" onKeyDown={handleEditorKeyDown} />
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
            .deck-note-palette::-webkit-scrollbar,
            .deck-note-sinner-row::-webkit-scrollbar,
            .deck-note-rte__toolbar::-webkit-scrollbar,
            .deck-note-rte__content::-webkit-scrollbar {
              height: 0.375rem;
            }
            .deck-note-palette::-webkit-scrollbar-thumb,
            .deck-note-sinner-row::-webkit-scrollbar-thumb,
            .deck-note-rte__toolbar::-webkit-scrollbar-thumb,
            .deck-note-rte__content::-webkit-scrollbar-thumb {
              background: rgba(200, 144, 10, 0.26);
              border-radius: 999rem;
            }
            .deck-note-rte__container {
              display: flex;
              min-height: 34rem;
              flex-direction: column;
            }
            .deck-note-rte__menubar {
              flex-shrink: 0;
              border-bottom: 1px solid rgba(200, 144, 10, 0.14);
              border-radius: 0.5rem 0.5rem 0 0;
              background: #12100c;
            }
            .deck-note-rte__toolbar {
              display: flex;
              min-height: 2.75rem;
              max-width: 100%;
              align-items: center;
              gap: 0.25rem;
              overflow-x: auto;
              padding: 0.25rem 0.375rem;
              scrollbar-width: thin;
            }
            .deck-note-rte__group {
              display: flex;
              align-items: center;
              gap: 0.25rem;
            }
            .deck-note-rte__divider {
              width: 1px;
              height: 1.25rem;
              margin: 0 0.25rem;
              flex-shrink: 0;
              background: rgba(200, 144, 10, 0.16);
            }
            .deck-note-rte__button,
            .deck-note-rte__heading-button,
            .deck-note-rte__insert-button,
            .deck-note-preview-toggle {
              display: inline-flex;
              min-width: 2.5rem;
              min-height: 2.5rem;
              align-items: center;
              justify-content: center;
              border: 1px solid transparent;
              border-radius: 0.375rem;
              color: #b9aa90;
              background: transparent;
              transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
            }
            .deck-note-rte__button:not(:disabled) {
              cursor: pointer;
            }
            .deck-note-rte__button:disabled {
              cursor: not-allowed;
              opacity: 0.38;
            }
            .deck-note-rte__button:not(:disabled):hover,
            .deck-note-rte__heading-button:not(:disabled):hover,
            .deck-note-rte__insert-button:hover,
            .deck-note-rte__insert-button[aria-expanded="true"],
            .deck-note-rte__button[data-active] {
              border-color: rgba(200, 144, 10, 0.22);
              background: rgba(200, 144, 10, 0.1);
              color: #e8b030;
            }
            .deck-note-rte__button:focus-visible,
            .deck-note-rte__heading-button:focus-visible,
            .deck-note-rte__insert-button:focus-visible,
            .deck-note-preview-toggle:focus-visible,
            .deck-note-heading-menu__item:focus-visible,
            .deck-note-sinner-tab:focus-visible,
            .deck-note-chip-button:focus-visible,
            .deck-note-identity-avatar:focus-visible,
            .deck-note-skill-frame-button:focus-visible,
            .deck-note-passive-icon-button:focus-visible,
            .deck-note-gift-template-button:focus-visible,
            .deck-note-gift-detail-button:focus-visible,
            .deck-note-passive-detail-button:focus-visible,
            .deck-note-ego-chip-button:focus-visible {
              outline: 1px solid #e8b030;
              outline-offset: 2px;
            }
            .deck-note-rte__spacer {
              flex: 1 1 auto;
              min-width: 0.75rem;
            }
            .deck-note-rte__insert-button,
            .deck-note-preview-toggle {
              gap: 0.375rem;
              padding: 0 0.625rem;
              color: #c9b995;
              font-size: 0.9375rem;
              font-weight: 650;
              cursor: pointer;
            }
            .deck-note-preview-toggle[aria-pressed="true"] {
              border-color: rgba(232, 176, 48, 0.36);
              background: rgba(200, 144, 10, 0.12);
              color: #e8b030;
            }
            .deck-note-preview-toggle__track {
              position: relative;
              width: 2rem;
              height: 1rem;
              border: 1px solid rgba(200, 144, 10, 0.24);
              border-radius: 999rem;
              background: rgba(7, 6, 4, 0.55);
            }
            .deck-note-preview-toggle__thumb {
              position: absolute;
              top: 50%;
              left: 0.1875rem;
              width: 0.625rem;
              height: 0.625rem;
              border-radius: 999rem;
              background: #a99a80;
              transform: translateY(-50%);
              transition: transform 150ms ease, background-color 150ms ease;
            }
            .deck-note-preview-toggle[aria-pressed="true"] .deck-note-preview-toggle__thumb {
              background: #e8b030;
              transform: translate(0.875rem, -50%);
            }
            .deck-note-heading-dropdown {
              position: relative;
              display: inline-flex;
            }
            .deck-note-rte__heading-button {
              min-width: 7.5rem;
              gap: 0.375rem;
              padding: 0 0.5rem;
              justify-content: flex-start;
            }
            .deck-note-rte__heading-button:disabled {
              cursor: not-allowed;
              opacity: 0.38;
            }
            .deck-note-rte__heading-label {
              flex: 1;
              text-align: left;
              font-size: 0.9375rem;
              font-weight: 650;
            }
            .deck-note-rte__heading-button svg[data-open] {
              transform: rotate(180deg);
            }
            .deck-note-heading-menu {
              z-index: 1000;
              overflow: hidden;
              border: 1px solid rgba(200, 144, 10, 0.22);
              border-radius: 0.375rem;
              background: #17130e;
              box-shadow: 0 0.75rem 1.5rem rgba(5, 4, 3, 0.36);
              padding: 0.25rem;
            }
            .deck-note-heading-menu__item {
              display: grid;
              width: 100%;
              min-height: 2.5rem;
              grid-template-columns: 1.75rem 1.25rem 1fr 1rem;
              align-items: center;
              gap: 0.375rem;
              border: 1px solid transparent;
              border-radius: 0.25rem;
              background: transparent;
              color: #b9aa90;
              padding: 0 0.5rem;
              text-align: left;
              font-size: 0.9375rem;
              font-weight: 650;
            }
            .deck-note-heading-menu__item:hover,
            .deck-note-heading-menu__item[data-active] {
              border-color: rgba(200, 144, 10, 0.2);
              background: rgba(200, 144, 10, 0.1);
              color: #e8b030;
            }
            .deck-note-heading-menu__display {
              color: inherit;
              font-family: var(--font-mono);
              font-size: 0.875rem;
              opacity: 0.8;
            }
            .deck-note-sinner-tool {
              border-top: 1px solid rgba(200, 144, 10, 0.08);
              background: #100d09;
            }
            .deck-note-sinner-tabs {
              display: flex;
              max-width: 100%;
              align-items: flex-end;
              gap: 0.25rem;
              overflow-x: auto;
              padding: 0.375rem 0.5rem 0;
              scrollbar-width: thin;
            }
            .deck-note-sinner-tab {
              display: inline-flex;
              min-width: 2.5rem;
              min-height: 2.5rem;
              align-items: center;
              justify-content: center;
              border: 1px solid rgba(200, 144, 10, 0.12);
              border-bottom-color: rgba(200, 144, 10, 0.08);
              border-radius: 0.375rem 0.375rem 0 0;
              background: rgba(255, 255, 255, 0.018);
              opacity: 0.52;
              transition: background-color 150ms ease, border-color 150ms ease, opacity 150ms ease;
            }
            .deck-note-sinner-tab:not([data-muted]),
            .deck-note-sinner-tab[data-selected] {
              opacity: 1;
            }
            .deck-note-sinner-tab[data-selected] {
              position: relative;
              z-index: 1;
              border-color: rgba(232, 176, 48, 0.38);
              border-bottom-color: #100d09;
              background: rgba(200, 144, 10, 0.12);
            }
            .deck-note-palette {
              min-height: 3rem;
              overflow-x: auto;
              border-top: 1px solid rgba(200, 144, 10, 0.12);
              padding: 0.5rem;
              scrollbar-width: thin;
            }
            .deck-note-palette__hint {
              display: flex;
              min-height: 2.5rem;
              align-items: center;
              color: var(--text-tertiary);
              font-size: 0.875rem;
            }
            .deck-note-palette__lanes {
              display: flex;
              min-width: max-content;
              flex-direction: column;
              gap: 0.5rem;
            }
            .deck-note-palette__lane {
              display: flex;
              min-height: 2.75rem;
              align-items: center;
            }
            .deck-note-palette__tool-row {
              display: flex;
              min-width: max-content;
              align-items: center;
              gap: 0.25rem;
            }
            .deck-note-identity-avatar {
              display: inline-flex;
              width: 2.75rem;
              height: 2.75rem;
              flex-shrink: 0;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              border: 1px solid rgba(232, 176, 48, 0.34);
              border-radius: 999rem;
              background: rgba(200, 144, 10, 0.08);
            }
            .deck-note-skill-frame-button {
              display: inline-flex;
              width: 2.875rem;
              height: 2.875rem;
              flex-shrink: 0;
              align-items: center;
              justify-content: center;
              border: 0;
              border-radius: 999rem;
              background: transparent;
              color: #d6cdbd;
              padding: 0.0625rem;
              opacity: 0.9;
              transition: opacity 150ms ease;
            }
            .deck-note-skill-frame-button:not(:disabled):hover {
              opacity: 1;
            }
            .deck-note-small-skill-frame {
              display: inline-flex;
              width: 2.75rem;
              height: 2.75rem;
              flex-shrink: 0;
              align-items: center;
              justify-content: center;
            }
            .deck-note-passive-icon-button {
              display: inline-flex;
              min-width: 2.25rem;
              min-height: 2.25rem;
              flex-shrink: 0;
              align-items: center;
              justify-content: center;
              border: 0;
              border-radius: 999rem;
              background: transparent;
              color: var(--note-passive-color, #c8900a);
              padding: 0.125rem;
              opacity: 0.85;
              transition: opacity 150ms ease;
            }
            .deck-note-passive-icon-button:not(:disabled):hover {
              opacity: 1;
            }
            .deck-note-passive-detail-button,
            .deck-note-gift-detail-button,
            .deck-note-ego-chip-button {
              display: inline-flex;
              min-height: 2.5rem;
              flex-shrink: 0;
              align-items: center;
              gap: 0.375rem;
              border: 1px solid color-mix(in srgb, var(--note-passive-color, #c8900a) 22%, transparent);
              border-radius: 0.375rem;
              background: color-mix(in srgb, var(--note-passive-color, #c8900a) 10%, transparent);
              color: var(--note-passive-color, #c8900a);
              padding: 0 0.625rem;
              font-size: 0.875rem;
              font-weight: 650;
            }
            .deck-note-ego-chip-button {
              border-color: color-mix(in srgb, var(--note-ego-color, #c8900a) 22%, transparent);
              background: color-mix(in srgb, var(--note-ego-color, #c8900a) 10%, transparent);
              color: var(--note-ego-color, #c8900a);
            }
            .deck-note-gift-detail-button {
              border-color: rgba(208, 168, 90, 0.24);
              background: rgba(208, 168, 90, 0.1);
              color: #d0a85a;
            }
            .deck-note-gift-template-button {
              display: inline-flex;
              width: 2.75rem;
              height: 2.75rem;
              flex-shrink: 0;
              align-items: center;
              justify-content: center;
              gap: 0.25rem;
              border: 0;
              border-radius: 999rem;
              background: transparent;
              color: #d0a85a;
              padding: 0;
              font-size: 0.8125rem;
              font-weight: 650;
              opacity: 0.9;
              transition: opacity 150ms ease;
            }
            .deck-note-gift-template-button:not(:disabled):hover {
              opacity: 1;
            }
            .deck-note-identity-avatar:disabled,
            .deck-note-skill-frame-button:disabled,
            .deck-note-passive-icon-button:disabled,
            .deck-note-passive-detail-button:disabled,
            .deck-note-gift-detail-button:disabled,
            .deck-note-gift-template-button:disabled,
            .deck-note-chip-button:disabled,
            .deck-note-ego-chip-button:disabled {
              cursor: not-allowed;
              opacity: 0.42;
            }
            .deck-note-passive-detail-button__icons {
              display: inline-flex;
              align-items: center;
              gap: 0.125rem;
            }
            .deck-note-passive-detail-button__suffix {
              color: #a79a86;
              font-size: 0.75rem;
              font-family: var(--font-mono);
            }
            .deck-note-chip-button {
              display: inline-flex;
              min-height: 2.5rem;
              flex-shrink: 0;
              align-items: center;
              justify-content: center;
              border: 0;
              border-radius: 0.375rem;
              background: transparent;
              padding: 0 0.125rem;
            }
            .deck-note-rte__content {
              position: relative;
              display: flex;
              flex: 1;
              min-height: 24rem;
              overflow: auto;
              background: #0d0b08;
              color: #d6cdbd;
              scrollbar-width: thin;
            }
            .deck-note-editor-content {
              display: flex;
              width: 100%;
            }
            .deck-note-preview {
              width: 100%;
              min-height: 24rem;
              padding-block: 2.25rem;
              padding-inline: max(1rem, calc((100% - 48rem) / 2));
              color: #d6cdbd;
              font-size: 1rem;
              line-height: 1.72;
              user-select: text;
            }
            .deck-note-rte__content .ProseMirror {
              min-height: 24rem;
              flex: 1;
              width: 100%;
              padding-block: 2.25rem;
              padding-inline: max(1rem, calc((100% - 48rem) / 2));
              outline: none;
              font-family: var(--font-body);
              font-size: 1rem;
              line-height: 1.72;
              color: #d6cdbd;
              caret-color: var(--gold);
              white-space: pre-wrap;
              word-break: break-word;
            }
            .deck-note-rte__content:has(.ProseMirror-focused) {
              box-shadow: inset 0 0 0 1px rgba(232, 176, 48, 0.28);
            }
            .deck-note-rte__content .ProseMirror p {
              margin: 0.375rem 0;
            }
            .deck-note-rte__content .ProseMirror h1,
            .deck-note-rte__content .ProseMirror h2 {
              margin: 1.5rem 0 0.625rem;
              color: #f0d48a;
              font-family: var(--font-serif), var(--font-body);
              font-weight: 900;
              line-height: 1.18;
              letter-spacing: 0;
              text-wrap: balance;
            }
            .deck-note-rte__content .ProseMirror h1 {
              font-size: 2.125rem;
            }
            .deck-note-rte__content .ProseMirror h2 {
              font-size: 1.75rem;
            }
            .deck-note-rte__content .ProseMirror ul,
            .deck-note-rte__content .ProseMirror ol {
              margin: 0.5rem 0 0.75rem 1.25rem;
              padding-left: 1.25rem;
            }
            .deck-note-rte__content .ProseMirror ul {
              list-style-type: disc;
            }
            .deck-note-rte__content .ProseMirror ol {
              list-style-type: decimal;
            }
            .deck-note-rte__content .ProseMirror li {
              padding-left: 0.25rem;
              margin: 0.25rem 0;
            }
            .deck-note-rte__content .ProseMirror blockquote {
              margin: 0.75rem 0;
              padding: 0.5rem 0 0.5rem 0.875rem;
              border-left: 0.1875rem solid rgba(200, 144, 10, 0.45);
              border-radius: 0 0.375rem 0.375rem 0;
              background: rgba(200, 144, 10, 0.055);
              color: #c8c0b0;
            }
            .deck-note-rte__content .ProseMirror code {
              border: 1px solid rgba(200, 144, 10, 0.18);
              border-radius: 0.1875rem;
              background: rgba(200, 144, 10, 0.12);
              color: #e8b030;
              padding: 0.0625rem 0.25rem;
              font-family: var(--font-mono);
              font-size: 0.875rem;
            }
            .deck-note-rte__content .ProseMirror a {
              color: #e8b030;
              text-decoration: underline;
              text-underline-offset: 0.1875rem;
            }
            .deck-note-rte__content .ProseMirror p.is-editor-empty:first-child::before {
              content: attr(data-placeholder);
              float: left;
              color: var(--text-tertiary);
              pointer-events: none;
              height: 0;
            }
            @media (min-width: 768px) {
              .deck-note-rte__content .ProseMirror {
                min-height: 28rem;
              }
            }
          `}</style>
    </div>
  )
}

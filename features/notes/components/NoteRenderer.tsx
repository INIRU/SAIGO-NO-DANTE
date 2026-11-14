'use client'

import { memo } from 'react'
import { useLocale } from 'next-intl'
import NoteBlockViewer, { NoteKeywordLabel } from '@/features/notes/components/NoteBlockViewer'
import { parseBlockDocument, NOTE_PREFIX } from '@/lib/notes/blocks'
import { parseNoteImage } from '@/lib/notes/images'
import NoteLightboxImage from '@/features/notes/components/NoteLightboxImage'
import NoteTocLayout, { NoteHeadingLink } from '@/features/notes/components/NoteToc'
import { NOTE_TOC_MIN, markdownHeadings } from '@/features/notes'
import { PlaceholderText } from '@/components/ui/PlaceholderLabel'
import { type GiftConditionStatus } from '@/lib/planner/gift-condition-status'
import { useNoteGiftLookup } from '@/features/notes/hooks/useNoteGiftLookup'
import type { NoteEgoEntry, NoteEgoGiftEntry, NoteIdentityEntry, NotePassiveEntry, NoteSkillEntry } from '@/features/notes/lib/note-entries'
import {
  parseBlockPlaceholder,
  splitInlineTokens,
  splitMarkdownInline,
  splitMixedBlockLine,
  type NoteBlockPlaceholder,
  type NoteLookups,
} from '@/features/notes/lib/note-tokens'
import NoteSkillChip from './NoteSkillChip'
import NotePassiveChip from './NotePassiveChip'
import NoteEgoChip from './NoteEgoChip'
import NoteIdentityChip from './NoteIdentityChip'
import NoteEgoGiftChip from './NoteEgoGiftChip'
import NoteFallbackChip from './NoteFallbackChip'
import { SkillFramePlaceholder, PassiveBlockPlaceholder, GiftCardPlaceholder } from './NoteBlockCards'

// ── NoteRenderer ────────────────────────────────────────────────────────
function NoteRendererImpl({
  text,
  skillLookup = {},
  passiveLookup = {},
  egoLookup = {},
  identityLookup = {},
  egoGiftLookup = {},
  egoGiftConditionLookup = {},
  inline,
  giftLabel = false,
  allowedKeywords,
  textScale = 'default',
  anchors = false,
}: {
  text: string
  skillLookup?: Record<string, NoteSkillEntry>
  passiveLookup?: Record<string, NotePassiveEntry>
  egoLookup?: Record<string, NoteEgoEntry>
  identityLookup?: Record<string, NoteIdentityEntry>
  egoGiftLookup?: Record<string, NoteEgoGiftEntry>
  egoGiftConditionLookup?: Record<string, GiftConditionStatus | null>
  inline?: boolean
  /** Gifts as icon + name labels instead of chips (card previews). */
  giftLabel?: boolean
  allowedKeywords?: Set<string>
  textScale?: 'default' | 'comfortable'
  /** Headings get ids and a copy-link button, and a table of contents appears from three headings (detail pages, previews). */
  anchors?: boolean
}) {
  const locale = useLocale()
  if (!text.trim()) return null
  const doc = parseBlockDocument(text)
  if (doc) return <NoteBlockViewer doc={doc} renderText={value => value.trim() ? <NoteRenderer text={value} skillLookup={skillLookup} passiveLookup={passiveLookup} egoLookup={egoLookup} identityLookup={identityLookup} egoGiftLookup={egoGiftLookup} allowedKeywords={allowedKeywords} inline /> : value} NotePreview={NoteCardPreview} anchors={anchors} />
  if (text.startsWith(NOTE_PREFIX)) return null


  const lookups: NoteLookups = {
    skill: skillLookup,
    passive: passiveLookup,
    ego: egoLookup,
    identity: identityLookup,
    egoGift: egoGiftLookup,
    egoGiftCondition: egoGiftConditionLookup,
  }

  const renderMarkdownInline = (value: string, keyPrefix: string): React.ReactNode[] =>
    splitMarkdownInline(value).map(segment => {
      const key = `${keyPrefix}-${segment.keySuffix}`
      switch (segment.kind) {
        case 'text':
          return (
            <span key={key}>
              <PlaceholderText text={segment.text} />
            </span>
          )
        case 'link':
          return (
            <a
              key={key}
              href={segment.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--gold-light)', textDecoration: 'underline', textUnderlineOffset: '0.1875rem' }}
            >
              <PlaceholderText text={segment.text} />
            </a>
          )
        case 'bold':
          return (
            <strong key={key} style={{ color: '#d9d0bf', fontWeight: 700 }}>
              <PlaceholderText text={segment.text} />
            </strong>
          )
        case 'italic':
          return (
            <em key={key} style={{ color: '#d2c7b5', fontStyle: 'italic' }}>
              <PlaceholderText text={segment.text} />
            </em>
          )
        case 'code':
          return (
            <code
              key={key}
              style={{
                color: 'var(--gold-light)',
                background: 'rgba(200,144,10,0.12)',
                border: '1px solid rgba(200,144,10,0.18)',
                borderRadius: 3,
                padding: '0.0625rem 0.25rem',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {segment.text}
            </code>
          )
      }
    })

  const renderInline = (value: string, keyPrefix: string): React.ReactNode[] =>
    splitInlineTokens(value, lookups).flatMap((segment): React.ReactNode[] => {
      const key = `${keyPrefix}-${segment.keySuffix}`
      if (segment.kind === 'text') return renderMarkdownInline(segment.text, key)
      const { token } = segment
      switch (token.kind) {
        case 's':
          return [token.entry ? <NoteSkillChip key={key} entry={token.entry} /> : <NoteFallbackChip key={key} type="s" tokenKey={token.key} />]
        case 'p':
          return [token.entry ? <NotePassiveChip key={key} entry={token.entry} /> : <NoteFallbackChip key={key} type="p" tokenKey={token.key} />]
        case 'e':
          return [token.entry ? <NoteEgoChip key={key} entry={token.entry} /> : <NoteFallbackChip key={key} type="e" tokenKey={token.key} />]
        case 'k':
          // Memo keywords read like game text: an inline label, not a chip box.
          return [<NoteKeywordLabel key={key} id={token.key} />]
        case 'i':
          return [token.entry ? <NoteIdentityChip key={key} entry={token.entry} /> : <NoteFallbackChip key={key} type="i" tokenKey={token.key} />]
        case 'g':
          return [token.entry ? <NoteEgoGiftChip key={key} entry={token.entry} label={giftLabel} /> : <NoteFallbackChip key={key} type="g" tokenKey={token.key} />]
      }
    })

  const renderBlockPlaceholder = (placeholder: NoteBlockPlaceholder, keyPrefix: string): React.ReactNode => {
    switch (placeholder.kind) {
      case 'skill':
        return placeholder.entry
          ? (
              <SkillFramePlaceholder
                key={`${keyPrefix}-skill`}
                entry={placeholder.entry}
                lang={locale}
              />
            )
          : <NoteFallbackChip key={`${keyPrefix}-skill-fallback`} type="s" tokenKey={placeholder.tokenKey} />
      case 'passive':
        return placeholder.entry
          ? <PassiveBlockPlaceholder key={`${keyPrefix}-passive`} entry={placeholder.entry} />
          : <NoteFallbackChip key={`${keyPrefix}-passive-fallback`} type="p" tokenKey={placeholder.tokenKey} />
      case 'gift':
        return placeholder.entry
          ? <GiftCardPlaceholder key={`${keyPrefix}-gift`} entry={placeholder.entry} conditionStatus={placeholder.conditionStatus} />
          : <NoteFallbackChip key={`${keyPrefix}-gift-fallback`} type="g" tokenKey={placeholder.tokenKey} />
    }
  }

  const renderMixedBlockLine = (value: string, keyPrefix: string): React.ReactNode[] | null =>
    splitMixedBlockLine(value, lookups)?.flatMap((segment): React.ReactNode[] => {
      const key = `${keyPrefix}-${segment.keySuffix}`
      if (segment.kind === 'text') {
        return [
          <p key={key} style={{ margin: '0.375rem 0' }}>
            {renderInline(segment.text, key)}
          </p>,
        ]
      }
      return segment.placeholder ? [renderBlockPlaceholder(segment.placeholder, key)] : []
    }) ?? null

  const elements = renderInline(text, 'inline')
  // A sin-coloured note mark (app/globals.css) sets --note-sin-text for the words inside it.
  if (inline) return <span style={{ fontSize: '0.875rem', color: 'var(--note-sin-text, #b0a898)', lineHeight: 1.65 }}>{elements}</span>

  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const headings = anchors ? markdownHeadings(text) : []
  const headingAt = headings.length >= NOTE_TOC_MIN ? new Map(headings.map(heading => [heading.line, heading])) : null
  const blocks: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const image = parseNoteImage(line)
    if (image) {
      blocks.push(<figure key={`image-${i}`} className="my-4"><NoteLightboxImage src={image.src} alt={image.alt} width={1920} height={1920} className="h-auto max-h-[70dvh] w-auto max-w-full rounded-sm object-contain" /></figure>)
      i += 1
      continue
    }
    if (!line.trim()) {
      blocks.push(<div key={`blank-${i}`} style={{ height: '0.5rem' }} />)
      i += 1
      continue
    }

    const blockPlaceholder = parseBlockPlaceholder(line, lookups)
    if (blockPlaceholder) {
      blocks.push(renderBlockPlaceholder(blockPlaceholder, `block-${i}`))
      i += 1
      continue
    }

    const mixedBlockLine = renderMixedBlockLine(line, `mixed-${i}`)
    if (mixedBlockLine) {
      blocks.push(...mixedBlockLine)
      i += 1
      continue
    }

    const heading = line.match(/^(#{1,2})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const Tag = (level === 1 ? 'h3' : 'h4') as 'h3' | 'h4'
      const anchor = headingAt?.get(i)
      blocks.push(
        <Tag
          key={`h-${i}`}
          id={anchor?.id}
          className={anchor ? 'note-heading' : undefined}
          style={{
            color: '#d9d0bf',
            fontSize: level === 1 ? '1rem' : '0.9375rem',
            fontWeight: 700,
            lineHeight: 1.45,
            margin: i === 0 ? '0 0 0.5rem' : '1rem 0 0.5rem',
            textWrap: 'balance',
          }}
        >
          {renderInline(heading[2], `h-${i}`)}
          {anchor && <NoteHeadingLink id={anchor.id} text={anchor.text} />}
        </Tag>
      )
      i += 1
      continue
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      const quoteLines: string[] = [quote[1]]
      let j = i + 1
      while (j < lines.length) {
        const next = lines[j].match(/^>\s?(.*)$/)
        if (!next) break
        quoteLines.push(next[1])
        j += 1
      }
      blocks.push(
        <blockquote
          key={`q-${i}`}
          style={{
            borderLeft: '0.1875rem solid rgba(200,144,10,0.45)',
            padding: '0.5rem 0 0.5rem 0.875rem',
            margin: '0.75rem 0',
            color: '#c8c0b0',
            background: 'rgba(200,144,10,0.055)',
            borderRadius: '0 0.375rem 0.375rem 0',
          }}
        >
          {quoteLines.map((quoteLine, idx) => (
            <div key={idx}>{renderInline(quoteLine, `q-${i}-${idx}`)}</div>
          ))}
        </blockquote>
      )
      i = j
      continue
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/)
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/)
    if (unordered || ordered) {
      const orderedList = Boolean(ordered)
      const items: string[] = [unordered?.[1] ?? ordered?.[1] ?? '']
      let j = i + 1
      while (j < lines.length) {
        const item = orderedList
          ? lines[j].match(/^\s*\d+\.\s+(.+)$/)
          : lines[j].match(/^\s*[-*]\s+(.+)$/)
        if (!item) break
        items.push(item[1])
        j += 1
      }
      const ListTag = (orderedList ? 'ol' : 'ul') as 'ol' | 'ul'
      blocks.push(
        <ListTag
          key={`list-${i}`}
          style={{
            margin: '0.5rem 0 0.75rem 1.25rem',
            padding: 0,
            listStyleType: orderedList ? 'decimal' : 'disc',
          }}
        >
          {items.map((item, idx) => (
            <li key={idx} style={{ paddingLeft: '0.25rem', margin: '0.25rem 0' }}>
              {renderInline(item, `list-${i}-${idx}`)}
            </li>
          ))}
        </ListTag>
      )
      i = j
      continue
    }

    const paragraphLines = [line.trim()]
    let j = i + 1
    while (j < lines.length) {
      const next = lines[j]
      if (!next.trim() || parseNoteImage(next)) break
      if (
        next.match(/^(#{1,2})\s+(.+)$/) ||
        next.match(/^>\s?(.*)$/) ||
        next.match(/^\s*[-*]\s+(.+)$/) ||
        next.match(/^\s*\d+\.\s+(.+)$/) ||
        parseBlockPlaceholder(next, lookups)
      ) {
        break
      }
      paragraphLines.push(next.trim())
      j += 1
    }
    blocks.push(
      <p key={`p-${i}`} style={{ margin: '0.375rem 0' }}>
        {renderInline(paragraphLines.join(' '), `p-${i}`)}
      </p>
    )
    i = j
  }

  const body = (
    <div
      style={{
        fontSize: textScale === 'comfortable' ? '1rem' : '0.9375rem',
        color: '#b0a898',
        lineHeight: textScale === 'comfortable' ? 1.8 : 1.85,
        maxWidth: '72ch',
      }}
    >
      {blocks}
    </div>
  )
  return headingAt ? <NoteTocLayout headings={headings}>{body}</NoteTocLayout> : body
}

/** Memoized: a note re-renders only when its text or lookups change (pages re-render on every vote, bookmark and comment). */
export const NoteRenderer = memo(NoteRendererImpl)

/** The one-line note under a deck or plan card (`NotePreview` of the cards in components/cards). */
export function NoteCardPreview({ text }: { text: string }) {
  const giftLookup = useNoteGiftLookup(text)
  return <NoteRenderer text={text} egoGiftLookup={giftLookup} giftLabel inline />
}
#!/usr/bin/env tsx
/**
 * Official Steam/X news collector for limbus.official_news_events.
 *
 * Usage:
 *   npx tsx scripts/sync/official-news-calendar.ts --dry-run
 *   npx tsx scripts/sync/official-news-calendar.ts --apply
 *   npx tsx scripts/sync/official-news-calendar.ts --source steam --dry-run
 *   npx tsx scripts/sync/official-news-calendar.ts --cleanup-only --dry-run
 */

import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { createAdminClient } from '../../lib/supabase/admin'
import { CACHE_TAGS } from '../../lib/constants/cache-tags'
import type { OfficialNewsSource } from '../../lib/types'

config({ path: '.env.local' })

const STEAM_APP_ID = '1973530'
const STORAGE_BUCKET = 'limbus-assets'
const STORAGE_PREFIX = 'official-news/'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_IMAGES_PER_EVENT = 8
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const CALENDAR_PATHS = ['/ko/calendar', '/en/calendar', '/ja/calendar'] as const
const DEFAULT_X_USERNAME = 'LimbusCompany_B'

type SourceFilter = 'all' | OfficialNewsSource

type CliOptions = {
  apply: boolean
  source: SourceFilter
  cleanupOnly: boolean
  xUsername: string
  nitterHtmlPath: string | null
  nitterHtmlBaseUrl: string | null
  nitterBaseUrls: string[]
}

type NormalizedNewsEvent = {
  source: OfficialNewsSource
  source_item_id: string
  source_url: string
  title: string
  summary: string
  body: string
  starts_at: string
  ends_at: string | null
  published_at: string | null
  image_candidate_urls: string[]
  image_url: string | null
  image_path: string | null
  image_urls: string[]
  image_paths: string[]
  image_bucket: string | null
  locale: string | null
  tags: string[]
  raw_payload: Record<string, unknown>
}

type UpsertNewsEvent = Omit<NormalizedNewsEvent, 'image_candidate_urls'>

type CleanupCandidate = {
  id: string
  image_path: string | null
  image_paths: string[] | null
  image_bucket: string | null
}

type SourceResult = {
  source: OfficialNewsSource
  events: NormalizedNewsEvent[]
  skipped?: string
}

type SteamNewsItem = Record<string, unknown>

type SteamPartnerEvent = {
  gid?: string
  event_name?: string
  rtime32_start_time?: number
  rtime32_end_time?: number
  announcement_body?: {
    gid?: string
    headline?: string
    posttime?: number
    updatetime?: number
    body?: string
    language?: number
    tags?: string[]
    event_gid?: string
  }
}

type LocalizedSteamAnnouncement = {
  event_gid: string
  announcement_gid: string | null
  title: string
  body: string
  source_url: string
  raw_event: SteamPartnerEvent
  localized: boolean
}

type CalendarDateResolution = {
  starts_at: string
  ends_at: string | null
  source: 'steam_event_time' | 'parsed_content' | 'published_at_fallback'
  match: string
}

type DateMatch = {
  year: number | null
  month: number
  day: number
  hour: number | null
  minute: number | null
  index: number
  endIndex: number
  text: string
  score: number
}

function getOptionValue(args: string[], name: string): string | null {
  const index = args.indexOf(name)
  const value = index === -1 ? null : args[index + 1]
  return value && !value.startsWith('--') ? value : null
}

function getRepeatedOptionValues(args: string[], name: string): string[] {
  const values: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue
    const value = args[index + 1]
    if (value && !value.startsWith('--')) values.push(value)
  }
  return values
}

function parseListInput(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function parseCliOptions(args: string[]): CliOptions {
  const sourceValue = getOptionValue(args, '--source') ?? 'all'
  if (sourceValue !== 'all' && sourceValue !== 'steam' && sourceValue !== 'x') {
    throw new Error('--source must be one of: all, steam, x')
  }

  const xUsername = (
    getOptionValue(args, '--x-username') ??
    getOptionValue(args, '--x-handle') ??
    process.env.X_USERNAME ??
    process.env.X_USER_NAME ??
    process.env.X_HANDLE ??
    DEFAULT_X_USERNAME
  ).trim().replace(/^@/, '')
  if (!xUsername) throw new Error('--x-username must not be empty')

  const cliNitterBaseUrls = getRepeatedOptionValues(args, '--nitter-base-url')
    .flatMap(value => parseListInput(value))
  const envNitterBaseUrls = parseListInput(process.env.NITTER_BASE_URLS ?? process.env.NITTER_BASE_URL)
  const nitterBaseUrls = [...cliNitterBaseUrls, ...envNitterBaseUrls]

  return {
    apply: args.includes('--apply'),
    source: sourceValue,
    cleanupOnly: args.includes('--cleanup-only'),
    xUsername,
    nitterHtmlPath: getOptionValue(args, '--nitter-html') ?? process.env.NITTER_HTML_PATH?.trim() ?? null,
    nitterHtmlBaseUrl: getOptionValue(args, '--nitter-html-base-url') ?? process.env.NITTER_HTML_BASE_URL?.trim() ?? null,
    nitterBaseUrls,
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/\b(access_token|apikey|api_key|token|secret|password)=([^&\s]+)/gi, '$1=[redacted]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, match => {
      try {
        const url = new URL(match)
        if (url.search) url.search = '?[redacted]'
        return url.toString()
      } catch {
        return match
      }
    })
}

function stringifyErrorDetail(value: unknown): string | null {
  if (typeof value === 'string') return redactSensitiveText(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function formatSafeError(error: unknown): string {
  const record = asRecord(error)
  if (record) {
    const parts = ['message', 'code', 'details', 'hint']
      .flatMap(key => {
        const value = stringifyErrorDetail(record[key])
        return value ? [`${key}=${value}`] : []
      })
    if (parts.length > 0) return parts.join('; ')
  }

  if (error instanceof Error) return redactSensitiveText(error.message)
  return 'unrecognized error'
}

function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  }
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token: string) => {
    const lower = token.toLowerCase()
    if (lower.startsWith('#x')) {
      const code = Number.parseInt(lower.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity
    }
    if (lower.startsWith('#')) {
      const code = Number.parseInt(lower.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity
    }
    return named[lower] ?? entity
  })
}

function decodeHtmlAttribute(input: string): string {
  return decodeEntities(input)
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
}

function toPlainText(input: string): string {
  return decodeEntities(input)
    .replace(/\r\n/g, '\n')
    .replace(/\[img\][\s\S]*?\[\/img\]/gi, ' ')
    .replace(/\[url=[^\]]+\]([\s\S]*?)\[\/url\]/gi, '$1')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function hasKoreanText(value: string): boolean {
  return /[가-힣]/.test(value)
}

function toKstDate(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS)
}

function kstParts(date: Date) {
  const kst = toKstDate(date)
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
  }
}

function kstDateToUtcIso(year: number, month: number, day: number, hour = 0, minute = 0): string {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - KST_OFFSET_MS).toISOString()
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    year >= 2020 &&
    year <= 2100 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function normalizeComparableText(value: string | null): string {
  return toPlainText(value ?? '')
    .replace(/&/g, 'and')
    .replace(/[\s"'`~!@#$%^*()_\-+=[\]{}\\|;:,.<>/?]+/g, '')
    .toLowerCase()
}

function parseKoreanTime(raw: string): { hour: number | null; minute: number | null } {
  const match = raw.match(/(오전|오후)?\s*(\d{1,2})\s*(?:시|:)\s*(\d{1,2})?\s*분?/)
  if (!match) return { hour: null, minute: null }

  const meridiem = match[1]
  let hour = Number(match[2])
  const minute = match[3] ? Number(match[3]) : 0
  if (hour > 23 || minute > 59) return { hour: null, minute: null }

  if (meridiem === '오후' && hour < 12) hour += 12
  if (meridiem === '오전' && hour === 12) hour = 0
  return { hour, minute }
}

function inferScheduleYear(month: number, day: number, publishedAt: Date): number {
  const published = kstParts(publishedAt)
  let year = published.year
  const candidate = Date.UTC(year, month - 1, day)
  const publishedDay = Date.UTC(published.year, published.month - 1, published.day)
  const daysBeforePublished = (publishedDay - candidate) / (24 * 60 * 60 * 1000)

  if (daysBeforePublished > 180) year += 1
  return year
}

function scoreDateMatch(text: string, index: number, endIndex: number, titleLength: number, explicitYear: boolean, candidateIso: string, publishedAt: Date): number {
  const context = text.slice(Math.max(0, index - 40), Math.min(text.length, endIndex + 80))
  let score = 0
  if (index <= titleLength + 1) score += 30
  if (explicitYear) score += 10
  if (/정기\s*업데이트|점검|업데이트|이벤트\s*기간|기간|부터|까지|KST|패치|오픈|시작|종료/.test(context)) score += 50
  if (/[~～-]|부터|까지/.test(context)) score += 15

  const candidate = new Date(candidateIso)
  const daysFromPublished = (candidate.getTime() - publishedAt.getTime()) / (24 * 60 * 60 * 1000)
  if (daysFromPublished < -2) score -= 30
  if (daysFromPublished > 370) score -= 20
  return score
}

function extractScheduleDateMatches(title: string, body: string, publishedAt: Date): DateMatch[] {
  const text = `${title}\n${body}`
  const titleLength = title.length
  const matches: DateMatch[] = []
  const datePattern = /(?:(20\d{2})\s*(?:년|[./-])\s*)?(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*(?:일)?/g

  for (const match of text.matchAll(datePattern)) {
    const raw = match[0]
    const yearText = match[1] ?? null
    const month = Number(match[2])
    const day = Number(match[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) continue

    const inferredYear = yearText ? Number(yearText) : inferScheduleYear(month, day, publishedAt)
    if (!isValidCalendarDate(inferredYear, month, day)) continue

    const after = text.slice((match.index ?? 0) + raw.length, (match.index ?? 0) + raw.length + 32)
    const time = parseKoreanTime(after)
    const iso = kstDateToUtcIso(inferredYear, month, day, time.hour ?? 0, time.minute ?? 0)
    const index = match.index ?? 0
    const endIndex = index + raw.length

    matches.push({
      year: yearText ? inferredYear : null,
      month,
      day,
      hour: time.hour,
      minute: time.minute,
      index,
      endIndex,
      text: raw,
      score: scoreDateMatch(text, index, endIndex, titleLength, Boolean(yearText), iso, publishedAt),
    })
  }

  return matches
}

function resolveParsedContentCalendarDate(title: string, body: string, publishedAt: Date): CalendarDateResolution | null {
  const matches = extractScheduleDateMatches(title, body, publishedAt)
  if (matches.length === 0) return null

  const [best] = [...matches].sort((a, b) => b.score - a.score || a.index - b.index)
  if (!best) return null

  const startYear = best.year ?? inferScheduleYear(best.month, best.day, publishedAt)
  const startsAt = kstDateToUtcIso(startYear, best.month, best.day, best.hour ?? 0, best.minute ?? 0)
  const rangeCandidates = matches
    .filter(candidate => candidate.index > best.endIndex && candidate.index - best.endIndex <= 120)
    .sort((a, b) => a.index - b.index)
  const rangeContext = `${title}\n${body}`.slice(best.endIndex, rangeCandidates[0]?.index ?? best.endIndex)
  const rangeEnd = /[~～]|부터|까지|기간/.test(rangeContext) ? rangeCandidates[0] : null
  const endYear = rangeEnd ? rangeEnd.year ?? inferScheduleYear(rangeEnd.month, rangeEnd.day, publishedAt) : null
  const endsAt = rangeEnd && endYear
    ? kstDateToUtcIso(endYear, rangeEnd.month, rangeEnd.day, rangeEnd.hour ?? 23, rangeEnd.minute ?? 59)
    : null

  return {
    starts_at: startsAt,
    ends_at: endsAt,
    source: 'parsed_content',
    match: endsAt ? `${best.text} ... ${rangeEnd?.text}` : best.text,
  }
}

function resolveSteamEventCalendarDate(rawEvent: SteamPartnerEvent | null, publishedAt: Date): CalendarDateResolution | null {
  const start = asNumber(rawEvent?.rtime32_start_time)
  if (!start || start <= 0) return null

  const startsAt = new Date(start * 1000)
  const daysFromPublished = Math.abs((startsAt.getTime() - publishedAt.getTime()) / (24 * 60 * 60 * 1000))
  if (startsAt.getUTCFullYear() < 2020 || startsAt.getUTCFullYear() > 2100 || daysFromPublished > 370) return null

  const end = asNumber(rawEvent?.rtime32_end_time)
  const endsAt = end && end > start ? new Date(end * 1000).toISOString() : null
  return {
    starts_at: startsAt.toISOString(),
    ends_at: endsAt,
    source: 'steam_event_time',
    match: `rtime32_start_time=${start}${end ? `; rtime32_end_time=${end}` : ''}`,
  }
}

function resolveCalendarDate(input: {
  title: string
  body: string
  publishedAt: Date
  steamEvent: SteamPartnerEvent | null
}): CalendarDateResolution {
  return (
    resolveSteamEventCalendarDate(input.steamEvent, input.publishedAt) ??
    resolveParsedContentCalendarDate(input.title, input.body, input.publishedAt) ??
    {
      starts_at: input.publishedAt.toISOString(),
      ends_at: null,
      source: 'published_at_fallback',
      match: 'no explicit schedule date found',
    }
  )
}

function summarize(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 240) return normalized
  return `${normalized.slice(0, 237).trim()}...`
}

function sanitizeTitle(value: string | null, fallback: string): string {
  const title = toPlainText(value ?? '').replace(/\s+/g, ' ').trim()
  return title.slice(0, 500) || fallback
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function normalizeSteamImageUrl(value: string): string | null {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '')
  if (trimmed.startsWith('{STEAM_CLAN_IMAGE}/')) {
    return `https://clan.akamai.steamstatic.com/images/${trimmed.slice('{STEAM_CLAN_IMAGE}/'.length)}`
  }
  if (trimmed.startsWith('{STEAM_CLAN_LOC_IMAGE}/')) {
    return `https://clan.akamai.steamstatic.com/images/${trimmed.slice('{STEAM_CLAN_LOC_IMAGE}/'.length)}`
  }
  return normalizeUrl(trimmed)
}

function collectImageCandidates(candidates: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const urls: string[] = []

  for (const candidate of candidates) {
    const normalized = candidate ? normalizeUrl(candidate) : null
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    urls.push(normalized)
    if (urls.length >= MAX_IMAGES_PER_EVENT) break
  }

  return urls
}

function extractSteamImageCandidates(input: string): string[] {
  const candidates: Array<string | null> = []
  const attributePattern = /<(?:img|source)\b[^>]*\s(?:src|data-src|data-original|href)=["']([^"']+)["'][^>]*>/gi
  const srcsetPattern = /\s(?:srcset|data-srcset)=["']([^"']+)["']/gi

  for (const match of input.matchAll(attributePattern)) {
    candidates.push(match[1] ? normalizeSteamImageUrl(match[1]) : null)
  }

  for (const match of input.matchAll(srcsetPattern)) {
    const srcset = match[1] ?? ''
    for (const entry of srcset.split(',')) {
      const url = entry.trim().split(/\s+/)[0]
      candidates.push(url ? normalizeSteamImageUrl(url) : null)
    }
  }

  for (const match of input.matchAll(/\[img\]([^\[]+)\[\/img\]/gi)) {
    candidates.push(match[1] ? normalizeSteamImageUrl(match[1]) : null)
  }

  for (const match of input.matchAll(/(\{STEAM_CLAN(?:_LOC)?_IMAGE\}\/[^\s"'[\]<>)]+)/gi)) {
    candidates.push(match[1] ? normalizeSteamImageUrl(match[1]) : null)
  }

  for (const match of input.matchAll(/(https:\/\/[^\s"'[\]<>)]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'[\]<>)]+)?)/gi)) {
    candidates.push(match[1] ? normalizeSteamImageUrl(match[1]) : null)
  }

  for (const match of input.matchAll(/(https:\/\/(?:clan\.akamai\.steamstatic\.com|shared\.akamai\.steamstatic\.com|cdn\.akamai\.steamstatic\.com|steamuserimages-a\.akamaihd\.net|images\.akamai\.steamusercontent\.com)\/[^\s"'[\]<>)]+)/gi)) {
    candidates.push(match[1] ? normalizeSteamImageUrl(match[1]) : null)
  }

  return collectImageCandidates(candidates)
}

function monthKeyFromIso(iso: string): string {
  const date = new Date(iso)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'item'
}

function extensionFromContentType(contentType: string | null): string | null {
  const type = contentType?.split(';')[0]?.trim().toLowerCase()
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return null
}

function extensionFromUrl(url: string): string {
  const pathname = new URL(url).pathname.toLowerCase()
  const match = pathname.match(/\.([a-z0-9]+)$/)
  const ext = match?.[1]
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
  if (ext === 'png' || ext === 'webp' || ext === 'gif') return ext
  return 'jpg'
}

function buildImagePath(event: NormalizedNewsEvent, imageUrl: string, index = 0, contentType?: string | null): string {
  const ext = extensionFromContentType(contentType ?? null) ?? extensionFromUrl(imageUrl)
  const monthKey = monthKeyFromIso(event.starts_at)
  const suffix = index === 0 ? '' : `-${index + 1}`
  return `${STORAGE_PREFIX}${monthKey}/${event.source}-${sanitizePathPart(event.source_item_id)}${suffix}.${ext}`
}

function currentMonthStartIso(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

function requireSupabaseEnv(): void {
  process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY')
  }
}

async function fetchJson(url: URL, headers?: HeadersInit): Promise<unknown> {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`${url.hostname} returned ${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function fetchText(url: string | URL, headers?: HeadersInit): Promise<{ text: string; url: string }> {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    const hostname = typeof url === 'string' ? new URL(url).hostname : url.hostname
    throw new Error(`${hostname} returned ${response.status} ${response.statusText}`)
  }
  return { text: await response.text(), url: response.url }
}

function parseSteamPartnerEventStore(html: string): SteamPartnerEvent[] {
  const marker = 'data-partnereventstore="'
  const start = html.indexOf(marker)
  if (start === -1) return []

  const attrStart = start + marker.length
  const attrEnd = html.indexOf('"', attrStart)
  if (attrEnd === -1) return []

  try {
    const rawAttribute = html.slice(attrStart, attrEnd)
    const decoded = decodeHtmlAttribute(rawAttribute)
    const parsed: unknown = JSON.parse(decoded)
    return asArray(parsed)
      .map(asRecord)
      .filter((event): event is SteamPartnerEvent => Boolean(event))
  } catch {
    return []
  }
}

function extractSteamAnnouncementGid(url: string): string | null {
  const match = url.match(/\/announcements\/detail\/(\d+)/)
  return match?.[1] ?? null
}

function findMatchingSteamPartnerEvent(
  events: SteamPartnerEvent[],
  itemTitle: string,
  redirectedAnnouncementGid: string | null,
): SteamPartnerEvent | null {
  if (redirectedAnnouncementGid) {
    const byAnnouncementGid = events.find(event => event.announcement_body?.gid === redirectedAnnouncementGid)
    if (byAnnouncementGid) return byAnnouncementGid
  }

  const normalizedTitle = normalizeComparableText(itemTitle)
  if (!normalizedTitle) return events[0] ?? null

  return events.find(event => {
    const eventName = normalizeComparableText(event.event_name ?? null)
    const headline = normalizeComparableText(event.announcement_body?.headline ?? null)
    return eventName === normalizedTitle || headline === normalizedTitle
  }) ?? null
}

async function fetchLocalizedSteamAnnouncement(item: SteamNewsItem, fallbackTitle: string): Promise<LocalizedSteamAnnouncement | null> {
  const sourceUrl = normalizeUrl(asString(item.url))
  if (!sourceUrl) return null

  try {
    const sourcePage = await fetchText(sourceUrl)
    const sourceEvents = parseSteamPartnerEventStore(sourcePage.text)
    const redirectedAnnouncementGid = extractSteamAnnouncementGid(sourcePage.url)
    const sourceEvent = findMatchingSteamPartnerEvent(sourceEvents, fallbackTitle, redirectedAnnouncementGid)
    const eventGid = sourceEvent?.gid
    if (!eventGid) return null

    const localizedUrl = `https://store.steampowered.com/news/app/${STEAM_APP_ID}/view/${eventGid}?l=koreana`
    const localizedPage = await fetchText(localizedUrl)
    const localizedEvents = parseSteamPartnerEventStore(localizedPage.text)
    const localizedEvent = localizedEvents.find(event => event.gid === eventGid) ?? localizedEvents[0]
    const announcement = localizedEvent?.announcement_body
    const headline = asString(announcement?.headline)
    const body = asString(announcement?.body)

    if (!localizedEvent || !headline || !body || announcement?.language !== 4 || !hasKoreanText(`${headline}\n${body}`)) {
      return {
        event_gid: eventGid,
        announcement_gid: announcement?.gid ?? sourceEvent?.announcement_body?.gid ?? null,
        title: fallbackTitle,
        body: '',
        source_url: localizedUrl,
        raw_event: localizedEvent ?? sourceEvent,
        localized: false,
      }
    }

    return {
      event_gid: eventGid,
      announcement_gid: announcement.gid ?? sourceEvent?.announcement_body?.gid ?? null,
      title: headline,
      body,
      source_url: localizedUrl,
      raw_event: localizedEvent,
      localized: true,
    }
  } catch (err) {
    console.warn(`[sync] steam localization skipped for ${asString(item.gid) ?? 'unknown'}: ${formatSafeError(err)}`)
    return null
  }
}

async function fetchSteamEvents(): Promise<SourceResult> {
  const url = new URL('https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/')
  url.searchParams.set('appid', STEAM_APP_ID)
  url.searchParams.set('count', '20')
  url.searchParams.set('maxlength', '0')

  const payload = await fetchJson(url)
  const appnews = asRecord(asRecord(payload)?.appnews)
  const items = asArray(appnews?.newsitems)
  const events: NormalizedNewsEvent[] = []

  for (const itemValue of items) {
    const item = asRecord(itemValue)
    if (!item) continue

    const gid = asString(item.gid) ?? asString(item.id)
    const date = asNumber(item.date)
    if (!gid || !date) continue

    const title = sanitizeTitle(asString(item.title), `Steam news ${gid}`)
    const contents = asString(item.contents) ?? ''
    const publishedAtDate = new Date(date * 1000)
    const publishedAt = publishedAtDate.toISOString()
    const localized = await fetchLocalizedSteamAnnouncement(item, title)
    const bodySource = localized?.localized ? localized.body : contents
    const body = toPlainText(bodySource)
    const sourceUrl = localized?.localized
      ? localized.source_url
      : normalizeUrl(asString(item.url)) ?? `https://store.steampowered.com/news/app/${STEAM_APP_ID}`
    const eventTitle = localized?.localized ? sanitizeTitle(localized.title, title) : title
    const calendarDate = resolveCalendarDate({
      title: eventTitle,
      body,
      publishedAt: publishedAtDate,
      steamEvent: localized?.raw_event ?? null,
    })
    const imageCandidateUrls = collectImageCandidates([
      ...extractSteamImageCandidates(bodySource),
      ...extractSteamImageCandidates(contents),
      ...extractSteamImageCandidates(JSON.stringify(localized?.raw_event ?? {})),
    ])

    events.push({
      source: 'steam',
      source_item_id: gid,
      source_url: sourceUrl,
      title: eventTitle,
      summary: summarize(body || eventTitle),
      body,
      starts_at: calendarDate.starts_at,
      ends_at: calendarDate.ends_at,
      published_at: publishedAt,
      image_candidate_urls: imageCandidateUrls,
      image_url: null,
      image_path: null,
      image_urls: [],
      image_paths: [],
      image_bucket: null,
      locale: localized?.localized ? 'ko-KR' : null,
      tags: ['steam'],
      raw_payload: {
        ...item,
        steam_event_gid: localized?.event_gid ?? null,
        steam_announcement_gid: localized?.announcement_gid ?? null,
        localized_source: localized
          ? {
              locale: localized.localized ? 'ko-KR' : null,
              source_url: localized.source_url,
              found: localized.localized,
              language: localized.raw_event.announcement_body?.language ?? null,
            }
          : { found: false },
        calendar_date_source: calendarDate.source,
        calendar_date_match: calendarDate.match,
      },
    })
  }

  return { source: 'steam', events }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasHtmlClass(tag: string, className: string): boolean {
  const match = tag.match(/\sclass=(["'])(.*?)\1/i)
  if (!match) return false
  return match[2]?.split(/\s+/).includes(className) ?? false
}

function findElementBlocksByClass(html: string, className: string): string[] {
  const blocks: string[] = []
  const openingTagPattern = /<([a-z][a-z0-9-]*)\b[^>]*>/gi
  let openingMatch: RegExpExecArray | null

  while ((openingMatch = openingTagPattern.exec(html))) {
    const openingTag = openingMatch[0]
    const tagName = openingMatch[1]
    if (!tagName || !hasHtmlClass(openingTag, className)) continue

    const start = openingMatch.index
    const afterOpening = openingTagPattern.lastIndex
    const tagPattern = new RegExp(`<\\/?${escapeRegExp(tagName)}\\b[^>]*>`, 'gi')
    tagPattern.lastIndex = afterOpening
    let depth = 1
    let tagMatch: RegExpExecArray | null
    let end = html.length

    while ((tagMatch = tagPattern.exec(html))) {
      const tag = tagMatch[0]
      if (tag.startsWith('</')) {
        depth -= 1
        if (depth === 0) {
          end = tagPattern.lastIndex
          break
        }
      } else if (!tag.endsWith('/>')) {
        depth += 1
      }
    }

    blocks.push(html.slice(start, end))
    openingTagPattern.lastIndex = end
  }

  return blocks
}

function extractFirstElementByClass(html: string, className: string): string | null {
  return findElementBlocksByClass(html, className)[0] ?? null
}

function extractAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  for (const match of tag.matchAll(/\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)=(["'])(.*?)\2/g)) {
    const name = match[1]
    const value = match[3]
    if (name && value !== undefined) attributes[name.toLowerCase()] = decodeHtmlAttribute(value)
  }
  return attributes
}

function extractFirstAttributeFromSelectorBlock(html: string, className: string, tagName: string, attributeName: string): string | null {
  const block = extractFirstElementByClass(html, className)
  if (!block) return null

  const pattern = new RegExp(`<${tagName}\\b[^>]*\\s${attributeName}=(["'])(.*?)\\1[^>]*>`, 'i')
  const match = block.match(pattern)
  return match?.[2] ? decodeHtmlAttribute(match[2]) : null
}

function normalizeNitterBaseUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    url.pathname = url.pathname.replace(/\/+$/, '')
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function inferNitterBaseUrlFromHtml(html: string): string | null {
  const hrefMatch = html.match(/<link\b[^>]+\bhref=(["'])(https?:\/\/[^"']+\/opensearch)\1/i)
  if (hrefMatch?.[2]) {
    try {
      const url = new URL(hrefMatch[2])
      return normalizeNitterBaseUrl(`https://${url.hostname}`)
    } catch {
      // fall through to the title/site-name heuristic below
    }
  }

  const titleMatch = html.match(/<title>[\s\S]*?\|\s*([a-z0-9.-]+\.[a-z]{2,})\s*<\/title>/i)
  return normalizeNitterBaseUrl(titleMatch?.[1] ? `https://${decodeEntities(titleMatch[1])}` : null)
}

function normalizeNitterMediaUrl(value: string | null, baseUrl: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/\/(?:pic|image)\//i.test(trimmed) && baseUrl) {
    try {
      return normalizeUrl(new URL(trimmed, baseUrl).toString())
    } catch {
      return null
    }
  }
  if (/^https:\/\//i.test(trimmed)) return normalizeUrl(trimmed)
  if (baseUrl && trimmed.startsWith('/')) {
    try {
      return normalizeUrl(new URL(trimmed, baseUrl).toString())
    } catch {
      return null
    }
  }
  return null
}

function isNitterProfileImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return pathname.includes('/profile_images/') || pathname.includes('/profile_banners/') || pathname.includes('/avatar/')
  } catch {
    return true
  }
}

function extractNitterStatusHref(block: string, username: string): { href: string; id: string } | null {
  const usernamePattern = escapeRegExp(username)
  const pattern = new RegExp(`href=(["'])(\\/${usernamePattern}\\/status\\/(\\d+)(?:#[^"']*)?)\\1`, 'i')
  const match = block.match(pattern)
  const href = match?.[2]
  const id = match?.[3]
  return href && id ? { href: decodeHtmlAttribute(href), id } : null
}

function extractNitterContent(block: string): string {
  const contentBlock = extractFirstElementByClass(block, 'tweet-content')
  return toPlainText(contentBlock ?? '')
}

function extractNitterDateTitle(block: string): string | null {
  return extractFirstAttributeFromSelectorBlock(block, 'tweet-date', 'a', 'title')
}

function parseNitterPublishedAt(title: string | null): Date | null {
  if (!title) return null
  const normalized = title.replace(/\s*·\s*/g, ' ').replace(/\s+/g, ' ').trim()
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function extractNitterImageCandidates(block: string, baseUrl: string | null): string[] {
  const attachments = extractFirstElementByClass(block, 'attachments')
  if (!attachments) return []

  const stillImageCandidates: string[] = []
  const fallbackCandidates: string[] = []
  for (const tagMatch of attachments.matchAll(/<(?:a|img)\b[^>]*>/gi)) {
    const tag = tagMatch[0]
    const attributes = extractAttributes(tag)
    const classes = attributes.class?.split(/\s+/) ?? []
    const isStillImage = classes.includes('still-image')
    const candidate = isStillImage ? attributes.href ?? attributes.src : attributes.src ?? attributes.href
    const normalized = normalizeNitterMediaUrl(candidate ?? null, baseUrl)
    if (!normalized || isNitterProfileImageUrl(normalized)) continue
    if (isStillImage) {
      stillImageCandidates.push(normalized)
    } else {
      fallbackCandidates.push(normalized)
    }
  }

  return collectImageCandidates(stillImageCandidates.length > 0 ? stillImageCandidates : fallbackCandidates)
}

function parseNitterTimelineHtml(input: {
  html: string
  username: string
  baseUrl: string | null
  sourceLabel: string
}): NormalizedNewsEvent[] {
  const timelineItems = findElementBlocksByClass(input.html, 'timeline-item')
  const events: NormalizedNewsEvent[] = []

  for (const item of timelineItems) {
    const status = extractNitterStatusHref(item, input.username)
    if (!status) continue

    const body = extractNitterContent(item)
    if (!body) continue

    const dateTitle = extractNitterDateTitle(item)
    const publishedAt = parseNitterPublishedAt(dateTitle)
    if (!publishedAt) continue

    const title = sanitizeTitle(body.split('\n')[0] ?? body, `X post ${status.id}`)
    const calendarDate = resolveCalendarDate({
      title,
      body,
      publishedAt,
      steamEvent: null,
    })

    events.push({
      source: 'x',
      source_item_id: status.id,
      source_url: `https://x.com/${input.username}/status/${status.id}`,
      title,
      summary: summarize(body),
      body,
      starts_at: calendarDate.starts_at,
      ends_at: calendarDate.ends_at,
      published_at: publishedAt.toISOString(),
      image_candidate_urls: extractNitterImageCandidates(item, input.baseUrl),
      image_url: null,
      image_path: null,
      image_urls: [],
      image_paths: [],
      image_bucket: null,
      locale: null,
      tags: ['x', 'nitter'],
      raw_payload: {
        collector: 'nitter-html',
        source_label: input.sourceLabel,
        status_href: status.href,
        date_title: dateTitle,
        calendar_date_source: calendarDate.source,
        calendar_date_match: calendarDate.match,
      },
    })
  }

  return events
}

async function readBrowserNitterHtml(path: string): Promise<string> {
  const html = await readFile(path, 'utf8')
  return html.replace(/^\uFEFF/, '')
}

async function fetchDirectNitterHtml(baseUrl: string, username: string): Promise<{ html: string; baseUrl: string }> {
  const normalizedBaseUrl = normalizeNitterBaseUrl(baseUrl)
  if (!normalizedBaseUrl) throw new Error(`invalid Nitter base URL: ${baseUrl}`)

  const url = new URL(`/${encodeURIComponent(username)}`, normalizedBaseUrl)
  const page = await fetchText(url, {
    Accept: 'text/html,application/xhtml+xml',
    'User-Agent': 'limbus-archive-calendar-sync/1.0',
  })
  return { html: page.text, baseUrl: normalizedBaseUrl }
}

async function fetchXEvents(options: CliOptions): Promise<SourceResult> {
  const skipped: string[] = []
  const htmlBaseUrl = normalizeNitterBaseUrl(options.nitterHtmlBaseUrl ?? options.nitterBaseUrls[0] ?? null)

  if (options.nitterHtmlPath) {
    try {
      const html = await readBrowserNitterHtml(options.nitterHtmlPath)
      const browserHtmlBaseUrl = htmlBaseUrl ?? inferNitterBaseUrlFromHtml(html)
      const events = parseNitterTimelineHtml({
        html,
        username: options.xUsername,
        baseUrl: browserHtmlBaseUrl,
        sourceLabel: `browser-html:${options.nitterHtmlPath}`,
      })
      const skippedReason = events.length === 0
        ? 'browser-provided Nitter HTML had no parseable timeline items'
        : undefined
      return { source: 'x', events, skipped: skippedReason }
    } catch (err) {
      skipped.push(`browser HTML unavailable: ${formatSafeError(err)}`)
    }
  } else {
    skipped.push('browser HTML unavailable: pass --nitter-html <path> or set NITTER_HTML_PATH')
  }

  const normalizedBaseUrls = options.nitterBaseUrls
    .map(normalizeNitterBaseUrl)
    .filter((value): value is string => Boolean(value))
  if (normalizedBaseUrls.length === 0) {
    skipped.push('direct Nitter unavailable: set --nitter-base-url or NITTER_BASE_URLS')
    return { source: 'x', events: [], skipped: skipped.join('; ') }
  }

  for (const baseUrl of normalizedBaseUrls) {
    try {
      const { html, baseUrl: fetchedBaseUrl } = await fetchDirectNitterHtml(baseUrl, options.xUsername)
      const events = parseNitterTimelineHtml({
        html,
        username: options.xUsername,
        baseUrl: fetchedBaseUrl,
        sourceLabel: `direct:${fetchedBaseUrl}`,
      })
      if (events.length > 0) return { source: 'x', events, skipped: skipped.length > 0 ? skipped.join('; ') : undefined }
      skipped.push(`direct Nitter ${new URL(fetchedBaseUrl).hostname} returned no parseable timeline items`)
    } catch (err) {
      let host = baseUrl
      try {
        host = new URL(baseUrl).hostname
      } catch {
        // keep original value for the safe summary below
      }
      skipped.push(`direct Nitter ${host} failed: ${formatSafeError(err)}`)
    }
  }

  return { source: 'x', events: [], skipped: skipped.join('; ') }
}

async function loadCleanupCandidates(cutoffIso: string): Promise<CleanupCandidate[]> {
  requireSupabaseEnv()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('official_news_events')
    .select('id, image_path, image_paths, image_bucket')
    .or(`ends_at.lt.${cutoffIso},and(ends_at.is.null,starts_at.lt.${cutoffIso})`)

  if (error) throw error
  return (data ?? []) as unknown as CleanupCandidate[]
}

async function cleanupOldEvents(cutoffIso: string, apply: boolean): Promise<{ rows: number; files: number; skipped?: string }> {
  let candidates: CleanupCandidate[]
  try {
    candidates = await loadCleanupCandidates(cutoffIso)
  } catch (err) {
    if (apply) throw err
    return {
      rows: 0,
      files: 0,
      skipped: `cleanup preview skipped: ${formatSafeError(err)}`,
    }
  }

  const ownedPaths = Array.from(new Set(candidates.flatMap(candidate => {
    if (candidate.image_bucket !== STORAGE_BUCKET) return []
    return [candidate.image_path, ...(candidate.image_paths ?? [])]
      .filter((path): path is string => Boolean(path?.startsWith(STORAGE_PREFIX)))
  })))

  if (!apply) return { rows: candidates.length, files: ownedPaths.length }
  if (candidates.length === 0) return { rows: 0, files: 0 }

  const supabase = createAdminClient()
  if (ownedPaths.length > 0) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).remove(ownedPaths)
    if (error) throw error
    if (!data) throw new Error('Storage remove returned no result')
  }

  const { data, error } = await supabase
    .schema('limbus')
    .from('official_news_events')
    .delete()
    .in('id', candidates.map(candidate => candidate.id))
    .select('id')

  if (error) throw error
  return { rows: data?.length ?? 0, files: ownedPaths.length }
}

async function downloadImage(url: string): Promise<{ body: Buffer; contentType: string }> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`image fetch returned ${response.status} ${response.statusText}`)

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!contentType.startsWith('image/')) throw new Error(`image response content-type is ${contentType || 'missing'}`)

  const contentLength = Number(response.headers.get('content-length') ?? '0')
  if (contentLength > MAX_IMAGE_BYTES) throw new Error(`image is larger than ${MAX_IMAGE_BYTES} bytes`)

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error(`image is larger than ${MAX_IMAGE_BYTES} bytes`)
  return { body: buffer, contentType }
}

async function withUploadedImages(event: NormalizedNewsEvent): Promise<UpsertNewsEvent> {
  const { image_candidate_urls: imageCandidateUrls, ...row } = event
  if (imageCandidateUrls.length === 0) return row

  const supabase = createAdminClient()
  const imageUrls: string[] = []
  const imagePaths: string[] = []

  for (const imageCandidateUrl of imageCandidateUrls.slice(0, MAX_IMAGES_PER_EVENT)) {
    try {
      const image = await downloadImage(imageCandidateUrl)
      const imagePath = buildImagePath(event, imageCandidateUrl, imagePaths.length, image.contentType)
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(imagePath, image.body, {
        cacheControl: '31536000',
        contentType: image.contentType,
        upsert: true,
      })
      if (error) throw error
      if (!data) throw new Error('Storage upload returned no result')

      const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(imagePath)
      imageUrls.push(publicUrlData.publicUrl)
      imagePaths.push(imagePath)
    } catch (err) {
      console.warn(`[sync] image upload skipped for ${event.source}:${event.source_item_id}: ${err instanceof Error ? err.message : err}`)
    }
  }

  if (imageUrls.length === 0) return row
  return {
    ...row,
    image_url: imageUrls[0] ?? null,
    image_path: imagePaths[0] ?? null,
    image_urls: imageUrls,
    image_paths: imagePaths,
    image_bucket: STORAGE_BUCKET,
  }
}

async function upsertEvents(events: NormalizedNewsEvent[], apply: boolean): Promise<number> {
  if (!apply) return events.length
  if (events.length === 0) return 0

  requireSupabaseEnv()
  const rows = await Promise.all(events.map(withUploadedImages))
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('official_news_events')
    .upsert(rows, { onConflict: 'source,source_item_id' })
    .select('id')

  if (error) throw error
  return data?.length ?? 0
}

async function triggerCalendarRevalidation(apply: boolean): Promise<void> {
  if (!apply) return

  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.REVALIDATION_SECRET
  if (!siteUrl || !secret) {
    console.warn('[sync] SITE_URL or REVALIDATION_SECRET not set — skipping calendar revalidate')
    return
  }

  try {
    const response = await fetch(`${siteUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidation-secret': secret,
      },
      body: JSON.stringify({
        tags: [CACHE_TAGS.calendar],
        paths: CALENDAR_PATHS,
      }),
    })
    if (!response.ok) {
      console.warn(`[sync] calendar revalidate failed: ${response.status} ${response.statusText}`)
      return
    }
    const data = await response.json().catch(() => ({}))
    console.log('[sync] calendar revalidated:', (data as { revalidated?: unknown }).revalidated)
  } catch (err) {
    console.warn('[sync] calendar revalidate threw:', err instanceof Error ? err.message : err)
  }
}

async function collectSources(options: CliOptions): Promise<SourceResult[]> {
  const results: SourceResult[] = []
  if (options.source === 'all' || options.source === 'steam') {
    results.push(await fetchSteamEvents())
  }
  if (options.source === 'all' || options.source === 'x') {
    results.push(await fetchXEvents(options))
  }
  return results
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  const dryRun = !options.apply
  console.log(`[sync] official news calendar mode=${dryRun ? 'dry-run' : 'apply'} source=${options.source}`)

  const cutoffIso = currentMonthStartIso()
  const cleanup = await cleanupOldEvents(cutoffIso, options.apply)
  if (cleanup.skipped) {
    console.log(`[sync] cleanup: ${cleanup.skipped}`)
  } else {
    console.log(`[sync] cleanup: ${dryRun ? 'would remove' : 'removed'} rows=${cleanup.rows} files=${cleanup.files}`)
  }

  if (options.cleanupOnly) {
    await triggerCalendarRevalidation(options.apply && (cleanup.rows > 0 || cleanup.files > 0))
    return
  }

  const sourceResults = await collectSources(options)
  const upsertEventsBySource = new Map<OfficialNewsSource, NormalizedNewsEvent[]>()
  for (const result of sourceResults) {
    const currentMonthEvents = result.events.filter(event => event.starts_at >= cutoffIso)
    upsertEventsBySource.set(result.source, currentMonthEvents)
    const staleSkipped = result.events.length - currentMonthEvents.length
    const imageCandidates = currentMonthEvents.reduce((total, event) => total + event.image_candidate_urls.length, 0)
    const skipText = result.skipped ? ` skipped="${result.skipped}"` : ''
    console.log(`[sync] ${result.source}: fetched=${result.events.length} staleSkipped=${staleSkipped} upsertCandidates=${currentMonthEvents.length} imageCandidates=${imageCandidates}${skipText}`)
    if (dryRun && result.source === 'steam') {
      const preview = currentMonthEvents.slice(0, 3).map(event => {
        const source = asString(event.raw_payload.calendar_date_source) ?? 'unknown'
        return `${event.starts_at.slice(0, 10)} ${event.title.slice(0, 60)} (${source})`
      })
      if (preview.length > 0) console.log(`[sync] steam calendar preview: ${preview.join(' | ')}`)
    }
  }

  const events = sourceResults.flatMap(result => upsertEventsBySource.get(result.source) ?? [])
  const upserted = await upsertEvents(events, options.apply)
  console.log(`[sync] ${dryRun ? 'would upsert' : 'upserted'} events=${upserted}`)
  await triggerCalendarRevalidation(options.apply && (upserted > 0 || cleanup.rows > 0 || cleanup.files > 0))
}

main().catch((err: unknown) => {
  console.error('[sync] official news calendar failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})

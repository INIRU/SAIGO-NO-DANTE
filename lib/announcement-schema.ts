import { z } from 'zod'
import { announcementCover, announcementText, validAnnouncementDocument, type RichNode } from '@/lib/announcements'

// Request validation lives apart from lib/announcements so the public announcement body does not ship zod.
export const announcementDocumentSchema = z
  .custom<RichNode>(
    validAnnouncementDocument,
    '지원하지 않는 본문 또는 이미지입니다.',
  )
  .nullable()
  .optional()
export const announcementSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    content: z.string().max(50000).default(''),
    content_doc: announcementDocumentSchema,
    lang: z.enum(['ko', 'en', 'ja']).default('ko'),
    pinned: z.boolean().default(false),
    published: z.boolean().default(false),
    // 저장하지 않는 전송 옵션: 게시되는 순간 디스코드 알림에 @everyone을 붙인다
    discord_everyone: z.boolean().default(false),
  })
  .refine(
    (v) =>
      !v.published ||
      Boolean(
        v.content_doc
          ? announcementText(v.content_doc).trim() ||
              announcementCover(v.content_doc)
          : v.content.trim(),
      ),
    '게시할 본문을 작성해주세요.',
  )

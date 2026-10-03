import { z } from 'zod'
export const inquirySchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(10000),
  category: z.enum(['bug', 'data', 'account', 'suggestion', 'other']),
})
export const supportMessageSchema = z.object({ body: z.string().trim().min(1).max(10000) })
export const inquiryAdminPatchSchema = z
  .object({ closed: z.boolean().optional(), contribution_accepted: z.boolean().optional() })
  .refine(v => v.closed !== undefined || v.contribution_accepted !== undefined)
export type InquiryStatus = 'open' | 'answered' | 'closed'
export type SupportRole = 'user' | 'admin'
export type SupportMessage = { id?: string; author_role: SupportRole; body: string; created_at: string }
export type Inquiry = {
  id: string
  title: string
  category: string
  status: InquiryStatus
  created_at: string
  last_message_at: string | null
  last_admin_message_at: string | null
  user_last_read_at: string | null
  closed_at: string | null
  contribution_accepted: boolean
  reply: string
  support_messages: SupportMessage[]
  /** The inquirer's profile; only the admin routes select it. */
  author?: { username: string | null } | null
}
export const INQUIRY_FIELDS =
  'id,title,category,status,created_at,last_message_at,last_admin_message_at,user_last_read_at,closed_at,contribution_accepted,reply,support_messages(id,author_role,body,created_at)'
/** The admin inbox also names the inquirer (inquiries has two foreign keys to profiles: the key says which). */
export const ADMIN_INQUIRY_FIELDS = INQUIRY_FIELDS + ',author:profiles!inquiries_user_id_fkey(username)'
/** The inquirer's profile name; null when the account has none. */
export const inquirerName = (t: Pick<Inquiry, 'author'>) => t.author?.username?.trim() || null
const time = (v: string | null | undefined) => (v ? Date.parse(v) : 0)
export const sortMessages = (messages: SupportMessage[]) =>
  [...messages].sort((a, b) => time(a.created_at) - time(b.created_at))
/** Waiting on the admin after a user message; waiting on the user after an admin message. */
export const statusAfterMessage = (role: SupportRole): InquiryStatus => (role === 'admin' ? 'answered' : 'open')
export const statusOnReopen = (t: Pick<Inquiry, 'last_message_at' | 'last_admin_message_at'>): InquiryStatus =>
  t.last_admin_message_at && time(t.last_admin_message_at) >= time(t.last_message_at) ? 'answered' : 'open'
export const isUnread = (t: Pick<Inquiry, 'last_admin_message_at' | 'user_last_read_at'>) =>
  time(t.last_admin_message_at) > time(t.user_last_read_at)
export const lastActivity = (t: Pick<Inquiry, 'last_message_at' | 'created_at'>) => time(t.last_message_at ?? t.created_at)
/** Admin inbox: unanswered first, then most recent activity. */
export const sortInbox = <T extends Pick<Inquiry, 'status' | 'last_message_at' | 'created_at'>>(items: T[]) =>
  [...items].sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || lastActivity(b) - lastActivity(a))

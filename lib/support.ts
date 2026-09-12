import { z } from 'zod'
export const inquirySchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(10000),
  category: z.enum(['bug', 'data', 'account', 'suggestion', 'other']),
})
export const inquiryReplySchema = z
  .object({
    reply: z.string().trim().max(10000),
    status: z.enum(['open', 'answered', 'closed']),
    contribution_accepted: z.boolean().default(false),
  })
  .refine(
    (v) => v.status !== 'answered' || v.reply.length > 0,
    '답변을 입력해주세요.',
  )
  .refine(v => !v.contribution_accepted || (v.status !== 'open' && v.reply.length > 0), '기여 승인은 처리 결과를 답변한 후 가능합니다.')
export type Inquiry = {
  id: string
  title: string
  content: string
  category: string
  status: 'open' | 'answered' | 'closed'
  reply: string
  created_at: string
  updated_at: string
  replied_at: string | null
  contribution_accepted: boolean
}
export const supportCopy = {
  ko: {
    approveContribution: 'DB 수정 기여 승인 (+50 활동 점수)',
    contributionApproved: 'DB 수정 기여가 승인되었습니다. 활동 점수 +50',
    title: '문의',
    intro: '궁금한 점이나 사이트에서 발견한 문제를 알려주세요.',
    private: '문의 내용은 작성자와 관리자만 확인할 수 있습니다.',
    new: '새 문의',
    mine: '내 문의',
    all: '문의함',
    subject: '제목',
    body: '문의 내용',
    category: '문의 유형',
    send: '문의 보내기',
    reply: '관리자 답변',
    save: '답변 저장',
    empty: '아직 문의가 없습니다.',
    select: '목록에서 문의를 선택해주세요.',
    login: '로그인하고 문의하기',
    error: '처리하지 못했습니다. 다시 시도해주세요.',
    retry: '다시 시도',
    success: '저장되었습니다.',
    back: '목록으로',
    open: '접수',
    answered: '답변 완료',
    closed: '종료',
    bug: '오류 신고',
    data: '데이터 수정',
    account: '계정 문의',
    suggestion: '건의',
    other: '기타',
    pending: '답변을 기다리고 있습니다.',
    status: '처리 상태',
  },
  en: {
    approveContribution: 'Approve data contribution (+50 activity points)',
    contributionApproved: 'Data contribution approved. +50 activity points',
    title: 'Support',
    intro: 'Ask a question or tell us about a problem.',
    private: 'Only you and the administrators can read your inquiry.',
    new: 'New inquiry',
    mine: 'My inquiries',
    all: 'Inbox',
    subject: 'Subject',
    body: 'Message',
    category: 'Category',
    send: 'Send inquiry',
    reply: 'Administrator reply',
    save: 'Save reply',
    empty: 'No inquiries yet.',
    select: 'Select an inquiry from the list.',
    login: 'Sign in to contact us',
    error: 'Unable to complete the request. Please try again.',
    retry: 'Retry',
    success: 'Saved.',
    back: 'Back to list',
    open: 'Received',
    answered: 'Answered',
    closed: 'Closed',
    bug: 'Bug report',
    data: 'Data correction',
    account: 'Account',
    suggestion: 'Suggestion',
    other: 'Other',
    pending: 'Waiting for a reply.',
    status: 'Status',
  },
  ja: {
    approveContribution: 'データ修正への貢献を承認（活動ポイント +50）',
    contributionApproved: 'データ修正への貢献が承認されました。活動ポイント +50',
    title: 'お問い合わせ',
    intro: 'ご質問やサイトで見つけた問題をお知らせください。',
    private: '内容は投稿者と管理者のみ閲覧できます。',
    new: '新規お問い合わせ',
    mine: '自分のお問い合わせ',
    all: '受信箱',
    subject: '件名',
    body: '内容',
    category: '種類',
    send: '送信',
    reply: '管理者の返信',
    save: '返信を保存',
    empty: 'お問い合わせはありません。',
    select: '一覧から選択してください。',
    login: 'ログインして問い合わせる',
    error: '処理できませんでした。再試行してください。',
    retry: '再試行',
    success: '保存しました。',
    back: '一覧へ',
    open: '受付',
    answered: '返信済み',
    closed: '終了',
    bug: '不具合',
    data: 'データ修正',
    account: 'アカウント',
    suggestion: 'ご意見',
    other: 'その他',
    pending: '返信をお待ちください。',
    status: '対応状況',
  },
}

// 덱 페이지 공유 토큰 — 빌더 + 목록 + 상세에서 공통 사용

export const CONTENT_TYPES = ['스토리', '거던5층', '거던10층', '거던15층', '거굴철'] as const
export type ContentType = typeof CONTENT_TYPES[number]

export const CONTENT_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  '스토리':   { bg: 'rgba(80,120,200,0.15)', color: '#6090d0', border: 'rgba(80,120,200,0.4)' },
  '거던5층':  { bg: 'rgba(60,160,100,0.15)', color: '#50b878', border: 'rgba(60,160,100,0.4)' },
  '거던10층': { bg: 'rgba(60,160,100,0.18)', color: '#50b878', border: 'rgba(60,160,100,0.4)' },
  '거던15층': { bg: 'rgba(60,160,100,0.22)', color: '#50b878', border: 'rgba(60,160,100,0.4)' },
  '거굴철':   { bg: 'rgba(200,70,70,0.15)', color: '#d06060', border: 'rgba(200,70,70,0.4)' },
}

export const RARITY_COLORS: Record<string, string> = {
  '1성': '#667788',
  '2성': '#4898b0',
  '3성': '#c8900a',
}

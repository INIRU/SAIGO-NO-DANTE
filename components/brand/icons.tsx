import type { SVGProps } from 'react'

// 히어로 버튼 아이콘. DanteLogo와 같은 선 언어: currentColor, 24 그리드, 둥근 끝, 18px에서도 또렷한 1.75 선.
type IconProps = { size?: number | string } & SVGProps<SVGSVGElement>

function Svg({ size = 24, children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  )
}

// 수감자 목록: 시계 링 메달 속 인물, 12시 자리에 단테 로고의 별.
export function SinnerRosterIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8.3 4.2A8.6 8.6 0 1 0 15.7 4.2" />
      <path d="M12 1.4l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9Z" fill="currentColor" strokeWidth="0.8" />
      <circle cx="12" cy="11.4" r="2.5" />
      <path d="M7.4 18.6c1-2.2 2.7-3.3 4.6-3.3s3.6 1.1 4.6 3.3" />
    </Svg>
  )
}

// 덱 게시판: 겹친 카드, 앞 카드 윗단에 금테와 문장.
export function DeckBoardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.6" y="6" width="10.5" height="14" rx="1.5" transform="rotate(-10 8.85 13)" opacity="0.55" />
      <rect x="9" y="3.5" width="11" height="17" rx="1.5" />
      <path d="M9 7.2V5a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 20 5v2.2Z" fill="currentColor" />
      <path d="M14.5 10.6l2.3 3.2-2.3 3.2-2.3-3.2Z" strokeWidth="1.5" />
    </Svg>
  )
}

// 거울 던전 플래너: 거울 속 거울, 아래로 한 층씩 내려가는 액자.
export function MirrorDungeonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.8" y="2.8" width="16.4" height="18.4" rx="2.2" />
      <rect x="7.2" y="8" width="9.6" height="10.2" rx="1.4" strokeWidth="1.5" opacity="0.75" />
      <rect x="9.8" y="12.6" width="4.4" height="4.2" rx="0.8" fill="currentColor" stroke="none" />
      <path d="M6.6 6.4l1.6-1.4" strokeWidth="1.4" opacity="0.7" />
    </Svg>
  )
}

import styles from './Skeleton.module.css'
import SkeletonLabel from './SkeletonLabel'

type BoneProps = { className?: string; style?: React.CSSProperties; raised?: boolean; line?: boolean }

/**
 * 로딩 스켈레톤 조각. 서버 컴포넌트 호환.
 * raised: 패널(#17120c) 위에 놓일 때 한 단계 밝게. line: 실제 요소처럼 #2e2417 테두리.
 */
export default function Skeleton({ className = '', style, raised, line }: BoneProps) {
  return <div aria-hidden="true" data-skeleton className={`${styles.bone} ${raised ? styles.raised : ''} ${line ? styles.line : ''} rounded ${className}`} style={style} />
}

/** 한 줄 텍스트. w/h는 실제 글자 크기에 맞춘 rem 문자열. */
export function SkeletonLine({ w = '100%', h = '0.875rem', className = '', raised }: { w?: string; h?: string; className?: string; raised?: boolean }) {
  return <Skeleton className={`max-w-full ${className}`} style={{ width: w, height: h }} raised={raised} />
}

export function SkeletonCircle({ size, className = '', raised }: { size: string; className?: string; raised?: boolean }) {
  return <Skeleton className={`shrink-0 !rounded-full ${className}`} style={{ width: size, height: size }} raised={raised} />
}

/** 인격/덱 카드 포스터 (기본 3:4). */
export function SkeletonPoster({ ratio = '3 / 4', className = '', raised, line }: { ratio?: string; className?: string; raised?: boolean; line?: boolean }) {
  return <Skeleton className={`w-full ${className}`} style={{ aspectRatio: ratio }} raised={raised} line={line} />
}

/** E.G.O 기프트 타일: 정사각 아이콘 + 이름 한 줄. */
export function SkeletonGift({ className = '' }: { className?: string }) {
  return <div className={`min-w-0 ${className}`}><Skeleton className="w-full" style={{ aspectRatio: '1' }} /><SkeletonLine w="80%" h="0.625rem" className="mx-auto mt-1.5" /></div>
}

/** 로딩 영역 루트: role=status + aria-busy + 숨김 라벨. 안쪽 조각은 스크린리더에서 숨김. */
export function SkeletonPage({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div role="status" aria-busy="true" className={className} style={style}><SkeletonLabel />{children}</div>
}

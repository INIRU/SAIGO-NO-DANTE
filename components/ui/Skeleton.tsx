/**
 * 로딩 스켈레톤 플레이스홀더.
 * 서버 컴포넌트 호환 (클라이언트 전용 아님).
 */
export default function Skeleton({
  className = '',
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`motion-safe:animate-pulse rounded ${className}`}
      style={{ background: '#1a1510', ...style }}
    />
  )
}

import type { ReactNode } from 'react'
import Skeleton, { SkeletonLine } from '@/components/ui/Skeleton'

/** 목록·도구 페이지 공통 제목 블록. 높이를 바꾸면 PageHeaderSkeleton도 함께 맞춘다. */
export default function PageHeader({ title, description, actions, className = '' }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string
}) {
  return (
    <header className={`mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="break-keep font-[family-name:var(--font-heading)] text-[1.375rem] leading-tight text-[var(--gold)] md:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 text-[0.9375rem] leading-snug text-[#9c8b73]">{description}</p>}
      </div>
      {actions}
    </header>
  )
}

export function PageHeaderSkeleton({ titleWidth = '8rem', description = true, className = '' }: { titleWidth?: string; description?: boolean; className?: string }) {
  return (
    <div className={`mb-5 ${className}`}>
      <div className="flex h-[1.71875rem] items-center md:h-[2.1875rem]"><Skeleton className="h-[75%]" style={{ width: titleWidth }} /></div>
      {description && <div className="mt-1 flex h-[1.289rem] items-center"><SkeletonLine w="min(22rem, 90%)" h="0.9375rem" /></div>}
    </div>
  )
}

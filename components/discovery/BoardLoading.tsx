import Skeleton from '@/components/ui/Skeleton'
import BoardSkeleton from './BoardSkeleton'
export default function BoardLoading({ kind }: { kind: 'deck' | 'planner' }) {
  return <div className="mx-auto min-h-screen max-w-7xl space-y-10 px-6 pb-16 pt-32"><div className="space-y-4"><Skeleton className="h-3 w-36" /><Skeleton className="h-12 w-64" /><Skeleton className="h-4 w-72 max-w-full" /></div><div className="flex gap-3"><Skeleton className="h-10 w-16" /><Skeleton className="h-10 w-16" /><Skeleton className="h-10 w-24" /></div><BoardSkeleton kind={kind} shelf count={3} /></div>
}

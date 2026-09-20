import Skeleton from '@/components/ui/Skeleton'
import BoardSkeleton from './BoardSkeleton'
export default function BoardLoading({ kind }: { kind: 'deck' | 'planner' }) {
  return <div className="mx-auto min-h-screen max-w-7xl space-y-8 px-4 pb-16 pt-24 md:px-6 md:pt-28"><div className="space-y-3"><Skeleton className="h-3 w-28" /><Skeleton className="h-9 w-52 max-w-full" /><Skeleton className="h-4 w-72 max-w-full" /></div><div className="flex flex-wrap gap-2"><Skeleton className="h-10 w-16" /><Skeleton className="h-10 w-16" /><Skeleton className="h-10 w-24" /><Skeleton className="ml-auto h-10 w-24" /></div><div className="space-y-9">{Array.from({ length: 3 }, (_, index) => <BoardSkeleton key={index} kind={kind} shelf count={3} />)}</div></div>
}

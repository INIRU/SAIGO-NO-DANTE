import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AdminScrollLock from './AdminScrollLock'
import AdminSidebar from './AdminSidebar'

export const metadata = { title: '관리자 | SAIGO NO DANTE' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) redirect('/login')

  return (
    <div data-admin-shell className="flex h-[100dvh] overflow-hidden pt-[8rem] md:pt-[4rem]">
      <AdminScrollLock />
      <AdminSidebar />
      <div className="h-full w-full flex-1 overflow-y-auto px-4 pb-8 pt-4 md:px-8 md:pt-6">
        {children}
      </div>
    </div>
  )
}

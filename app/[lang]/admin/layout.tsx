import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AdminSidebar from './AdminSidebar'

export const metadata = { title: '관리자 | SAIGO NO DANTE' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) redirect('/login')

  return (
    <div className="flex min-h-[100dvh]">
      <AdminSidebar />
      <div className="flex-1 pt-[9rem] md:pt-24 pb-12 px-4 md:px-8 w-full md:max-w-[calc(100%-13.75rem)]">
        {children}
      </div>
    </div>
  )
}

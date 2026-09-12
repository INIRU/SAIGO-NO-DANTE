import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AdminNavigation from '@/components/admin/AdminNavigation'
export const metadata = { title: '관리자 | SAIGO NO DANTE' }
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin || session.user.isSuspended)
    redirect(`/${lang}/login`)
  return (
    <div data-admin-shell className="admin-shell">
      <AdminNavigation />
      <div className="admin-main">{children}</div>
    </div>
  )
}

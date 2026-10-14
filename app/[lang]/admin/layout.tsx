import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AdminNavigation from '@/components/admin/AdminNavigation'
import { HtmlFlag } from '@/hooks/useHtmlFlag'
import WithSectionMessages from '@/components/providers/WithSectionMessages'
export const metadata = { title: '관리자', robots: { index: false, follow: false } }
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
    <WithSectionMessages section="admin" lang={lang}>
      <div data-admin-shell className="admin-shell">
        <HtmlFlag name="with-admin-shell" />
        <AdminNavigation />
        <div className="admin-main">{children}</div>
      </div>
    </WithSectionMessages>
  )
}

import { getTranslations } from 'next-intl/server'
import SupportDesk from '@/components/support/SupportDesk'
export default async function InquiriesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [desk, shell] = await Promise.all([
    getTranslations({ locale: lang, namespace: 'supportDesk' }),
    getTranslations({ locale: lang, namespace: 'adminShell' }),
  ])
  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div>
          <h1>{desk('inbox')}</h1>
          <p>{shell('inquiriesIntro')}</p>
        </div>
      </header>
      <div className="admin-body is-flush">
        <SupportDesk admin />
      </div>
    </div>
  )
}

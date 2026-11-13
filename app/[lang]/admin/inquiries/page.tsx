import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import SupportDesk from '@/features/account/components/SupportDesk'
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ id?: string | string[] }> }
/** `?id=<inquiry>` (a notification's link) starts the inbox on that thread. The id goes into a request path, so only a uuid passes. */
export default async function InquiriesPage({ params, searchParams }: Props) {
  const [{ lang }, { id }] = await Promise.all([params, searchParams])
  const initialId = z.string().uuid().safeParse(id).data
  const desk = await getTranslations({ locale: lang, namespace: 'supportDesk' })
  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div>
          <h1>{desk('inbox')}</h1>
        </div>
      </header>
      <div className="admin-body is-flush">
        <SupportDesk key={initialId ?? 'inbox'} admin initialId={initialId} />
      </div>
    </div>
  )
}

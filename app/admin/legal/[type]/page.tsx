import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLegalDoc, type LegalDoc, type LegalSection } from '@/lib/data/legal'
import LegalEditorClient from './LegalEditorClient'

const EMPTY_DOCS: Record<string, LegalDoc> = {
  privacy: { type: 'privacy', title: '개인정보 처리방침', last_updated: '', sections: [] },
  terms:   { type: 'terms',   title: '이용약관',          last_updated: '', sections: [] },
}

const EMPTY_SECTION: LegalSection = { heading: '', body: '', items: [] }

export default async function AdminLegalEditorPage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type } = await params

  if (!['privacy', 'terms'].includes(type)) redirect('/admin/legal')

  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) redirect('/admin/legal')

  const doc = (await getLegalDoc(type as 'privacy' | 'terms')) ?? EMPTY_DOCS[type]
  if (doc.sections.length === 0) doc.sections = [{ ...EMPTY_SECTION }]

  const label = type === 'privacy' ? '개인정보 처리방침' : '이용약관'

  return (
    <div>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-center gap-2 text-sm" style={{ color: '#555566' }}>
          <Link href="/admin/legal" className="hover:text-yellow-300 transition-colors">
            약관 관리
          </Link>
          <span>›</span>
          <span style={{ color: 'var(--gold)' }}>{label}</span>
        </div>

        <LegalEditorClient initial={doc} />
      </div>
    </div>
  )
}

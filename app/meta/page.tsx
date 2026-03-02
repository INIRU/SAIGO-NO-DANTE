import { getSinners } from '@/lib/data/sinners'
import MetaClient from './MetaClient'

export default async function MetaPage() {
  const sinners = await getSinners()
  return <MetaClient sinners={sinners} />
}

import { getSinners, getIdentities } from '@/lib/data/sinners'
import MetaClient from './MetaClient'

export default async function MetaPage() {
  const [sinners, identities] = await Promise.all([getSinners(), getIdentities()])
  return <MetaClient sinners={sinners} identities={identities} />
}

import { getSinners, getIdentities, getEGOs, getAllSkills, getAllPassives } from '@/lib/data/sinners'
import DeckBuilderClient from './DeckBuilderClient'

export default async function NewDeckPage() {
  const [sinners, identities, egos, skills, passives] = await Promise.all([
    getSinners(), getIdentities(), getEGOs(), getAllSkills(), getAllPassives(),
  ])
  return <DeckBuilderClient sinners={sinners} identities={identities} egos={egos} skills={skills} passives={passives} />
}

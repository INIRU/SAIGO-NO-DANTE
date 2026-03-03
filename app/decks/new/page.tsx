import { getSinners, getIdentities, getEGOs, getAllSkills, getAllPassives, getEgoGiftsForNotes } from '@/lib/data/sinners'
import DeckBuilderClient from './DeckBuilderClient'

export const revalidate = 300

export default async function NewDeckPage() {
  const [sinners, identities, egos, skills, passives, egoGifts] = await Promise.all([
    getSinners(), getIdentities(), getEGOs(), getAllSkills(), getAllPassives(), getEgoGiftsForNotes(),
  ])
  return <DeckBuilderClient sinners={sinners} identities={identities} egos={egos} skills={skills} passives={passives} egoGifts={egoGifts} />
}

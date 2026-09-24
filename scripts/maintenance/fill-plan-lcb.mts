// Fills plan decks with LCB identities for missing sinners (slot_order 99). Dry run by default; APPLY=1 writes after saving a backup.
// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
config({ path: '.env.local', quiet: true })
// lib/constants/game.ts LCB_IDS
const LCB_IDS = { 'yi-sang': '10101', faust: '10201', 'don-quixote': '10301', ryoshu: '10401', meursault: '10501', 'hong-lu': '10601', heathcliff: '10701', ishmael: '10801', rodion: '10901', sinclair: '11001', outis: '11101', gregor: '11201' }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { db: { schema: 'limbus' } })
const { data: plans, error } = await sb.from('md_plans').select('id, deck')
if (error) throw error
const { data: lcb, error: idError } = await sb.from('identities').select('id, sinner_id, name_kr, rarity, keywords, skill_keyword_list, affiliation, association_list, game_id, folder_name').in('game_id', Object.values(LCB_IDS))
if (idError) throw idError
const changes = plans.flatMap(plan => {
  const deck = Array.isArray(plan.deck) ? plan.deck : []
  const have = new Set(deck.map(slot => slot.sinner_id))
  const fill = Object.keys(LCB_IDS).filter(sinner => !have.has(sinner)).map(sinner => lcb.find(identity => identity.sinner_id === sinner)).filter(Boolean)
    .map(identity => ({ identity_id: identity.id, sinner_id: identity.sinner_id, name_kr: identity.name_kr, rarity: identity.rarity, keywords: identity.keywords ?? [], skill_keyword_list: identity.skill_keyword_list, affiliation: identity.affiliation, association_list: identity.association_list, game_id: identity.game_id, folder_name: identity.folder_name, slot_order: 99 }))
  return fill.length ? [{ id: plan.id, before: deck, after: [...deck, ...fill] }] : []
})
console.log(JSON.stringify({ plans: plans.length, changed: changes.length, added: changes.reduce((n, c) => n + c.after.length - c.before.length, 0) }))
if (process.env.APPLY === '1') {
  const backup = `/tmp/md_plans_deck_backup_${Date.now()}.json`
  writeFileSync(backup, JSON.stringify(changes.map(({ id, before }) => ({ id, deck: before }))))
  for (const change of changes) {
    const { error: updateError } = await sb.from('md_plans').update({ deck: change.after }).eq('id', change.id)
    if (updateError) throw updateError
  }
  console.log('applied; backup at', backup)
}

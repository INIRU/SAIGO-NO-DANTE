// Build the calculator's compact catalog from the preserved Drive extraction.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = process.env.LUNACY_SOURCE_DIR || '../assets/recovery-2026-09-10/lunacy-sources'
const sources = []
async function read(name, key='list') {
  const raw = await readFile(`${root}/${name}`)
  sources.push({name,sha256:createHash('sha256').update(raw).digest('hex')})
  return JSON.parse(raw)[key]
}
const all = [...await read('iap-lunacy.json'),...await read('iap-membership.json'),...await read('iap-package.json'),...await read('iap-package-a1c9.json')]
const rows = new Map(all.map(r=>[r.id,r]))
const price = new Map((await read('pricetier.json')).map(r=>[r.priceTier,r.krw]))
const chance = new Map([...await read('chance-iap.json'),...await read('chance-iap-a1c9.json')].map(r=>[r.id,r]))
const names={}
for(const [lang,prefix] of [['ko','KR'],['en','EN'],['ja','JP']]) names[lang]=new Map([...await read(`${prefix}_IAPProduct.json`,'dataList'),...await read(`${prefix}_IAPProduct-a1c9.json`,'dataList')].map(r=>[r.id,r.name]))
function amounts(elements=[]) {
  const value=id=>elements.filter(r=>r.type==='ITEM'&&r.id===id).reduce((s,r)=>s+r.num,0)
  return {paid:value(1),free:value(2)}
}
const ids=[1,2,3,4,5,6,21,22,131,143,101,141,142,108,103,605,606]
const products=ids.map(id=>{
  const r=rows.get(id),first=id<=6,regular=first?rows.get(r.nextIdAfterChance):r,c=chance.get(r.chanceId)
  if(!r||!price.has(r.priceTier)||!regular)throw Error(`Missing product ${id}`)
  const base=amounts(regular.defaultElements),bonus=amounts(regular.bonusElements)
  return {id:String(id),name:Object.fromEntries(['ko','en','ja'].map(lang=>[lang,names[lang].get(id)])),price:price.get(r.priceTier),paid:base.paid+bonus.paid,free:base.free+bonus.free,
    ...(first?{firstPaid:amounts(r.defaultElements).paid+amounts(r.bonusElements).paid}:{}),
    ...(r.membershipDailyElements?{dailyFree:amounts(r.membershipDailyElements).free,days:30}:{}),
    limit:r.membershipDailyElements?'membership':first?'none':c?.resetTimeType.toLowerCase(),max:c?.max??1}
})
await mkdir('lib/generated',{recursive:true})
await writeFile('lib/generated/lunacy-products.json',JSON.stringify(products,null,2)+'\n')
await writeFile(`${root}/catalog-provenance.json`,JSON.stringify({sources,productIds:ids,notes:'KRW priceTier; ITEM 1 paid, ITEM 2 free, ITEM 101 single extraction, ITEM 102 ten extractions. Only free and paid currency enter totals. The selector exposes membership products 21 and 22 plus currency products 1 through 6; other product records are retained for existing saved plans. Extraction tickets are not counted or converted.'},null,2)+'\n')
console.log(`Built ${products.length} products from Drive sources`)

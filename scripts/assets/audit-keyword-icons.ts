/** Read-only audit of every resolved keyword URL against the preserved upload/source manifest. */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { getKeywordIconUrl } from '../../lib/constants/keywords'

async function main() {
  const [input, recovery, output] = process.argv.slice(2)
  if (!input || !recovery || !output) throw new Error('Usage: audit-keyword-icons.ts INPUT_JSON RECOVERY_ROOT OUTPUT_JSON')
  const rows = JSON.parse(readFileSync(input, 'utf8')) as Array<{name: string; icon_slug: string}>
  const plan = JSON.parse(readFileSync(join(recovery, 'artwork-upload-plan.json'), 'utf8')) as Array<{key:string; local:string; sourceId:string; sha256:string}>
  const byKey = new Map(plan.map(p => [p.key, p]))
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
  const urls = [...new Set(rows.map(r => getKeywordIconUrl(r.name, r.icon_slug)).filter((url): url is string => !!url))]
  const results = new Map<string, Record<string, unknown>>()
  let index = 0
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (index < urls.length) {
      const url = urls[index++]
      if (url.startsWith('/')) {
        const local = resolve('public', url.split('?')[0].slice(1))
        results.set(url, {status:'local', sha256:hash(readFileSync(local)), local})
        continue
      }
      const key = decodeURIComponent(url.split('/limbus-assets/')[1])
      const source = byKey.get(key)
      const response = await fetch(url, {signal:AbortSignal.timeout(30_000)})
      const sha256 = response.ok ? hash(Buffer.from(await response.arrayBuffer())) : null
      const expected = source ? hash(readFileSync(source.local)) : null
      results.set(url, {status: !response.ok ? 'http-error' : !source ? 'no-provenance' : sha256 === expected ? 'verified' : 'mismatch', http:response.status, sha256, sourceId:source?.sourceId, local:source?.local})
    }
  }))
  const report: Array<Record<string, unknown>> = rows.map(r => {const url=getKeywordIconUrl(r.name,r.icon_slug);return {...r,url,...(url ? results.get(url) : {status:'no-icon'})}})
  writeFileSync(output,JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({keywords:rows.length,urls:urls.length,issues:report.filter(r=>!['verified','local'].includes(String(r.status))).map(r=>({name:r.name,url:r.url,status:r.status}))}))
}
main().catch(error=>{console.error(error.message);process.exitCode=1})

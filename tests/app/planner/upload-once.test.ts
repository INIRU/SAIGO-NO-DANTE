import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('app/[lang]/planner/PlannerClient.tsx', 'utf8')

describe('upload once', () => {
  it('the upload handler returns early once the plan is uploaded', () => {
    expect(source).toMatch(/if \(uploading \|\| uploaded\) return/)
  })

  it('the upload button is disabled after the upload succeeds', () => {
    expect(source).toMatch(/onClick=\{handleUpload\}\s+disabled=\{[^}]*\buploaded\b[^}]*\}/)
  })
})

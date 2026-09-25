import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { expect, it } from 'vitest'

// Consent to the terms happens on the login page; any other direct Google sign-in would skip it.
it('starts Google sign-in only from the login page', () => {
  const files = execSync("git ls-files 'app/*.tsx' 'components/*.tsx' 'lib/*.ts' 'lib/*.tsx'", { encoding: 'utf8' }).split('\n').filter(Boolean)
  const callers = files.filter(file => /\bsignIn\(/.test(readFileSync(file, 'utf8')))
  expect(callers).toEqual(['app/[lang]/login/LoginClient.tsx'])
})

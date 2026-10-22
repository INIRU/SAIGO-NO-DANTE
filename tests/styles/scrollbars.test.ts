import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const files = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? files(path) : /\.(tsx?|css)$/.test(name) ? [path] : []
})

it('leaves every scrollbar to the site style: no scrollbar-width or scrollbar-color but `none`, outside the Firefox fallback', () => {
  // In Chrome and Safari either property switches an element from the site's ::-webkit-scrollbar to the system bar.
  const found = ['app', 'components', 'styles', 'hooks', 'lib'].flatMap(files).flatMap(path => readFileSync(path, 'utf8').split('\n')
    .map((line, i) => ({ at: `${path}:${i + 1}`, line }))
    .filter(({ line }) => /scrollbar-(width|color)|scrollbar(Width|Color)|\bscrollbar-thin\b/.test(line))
    .filter(({ line }) => !/none|@supports not selector\(::-webkit-scrollbar\)|^\s*(\/\*|\*)/.test(line)))
  expect(found.map(({ at }) => at)).toEqual([])
})

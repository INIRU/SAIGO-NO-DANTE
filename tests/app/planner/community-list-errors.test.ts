import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')
const community = read('features/planner/hooks/usePlanList.ts')
// the plan page's view count and vote live in the hook the page calls
const detail = read('features/planner/hooks/usePlanDetailReactions.ts')
const comments = read('features/planner/components/PlanComments.tsx')

/** The text of the `.catch(...)` that follows the nth fetch of the planner list. */
const catchAfter = (source: string, nth: number) => {
  const starts = [...source.matchAll(/fetch\(`\/api\/planner\?/g)].map(match => match.index!)
  const rest = source.slice(starts[nth])
  const from = rest.indexOf('.catch(')
  return rest.slice(from, rest.indexOf('.finally(', from))
}

describe('community list errors', () => {
  it('a failed first page shows an error, empties the list and stops loading more', () => {
    const handler = catchAfter(community, 0)
    expect(handler).toContain('showError(')
    expect(handler).toContain('setPlans([])')
    expect(handler).toContain('setHasMore(false)')
  })

  it('a failed load-more shows an error and stops loading more, without repeating the request', () => {
    const handler = catchAfter(community, 1)
    expect(handler).toContain('showError(')
    expect(handler).toContain('setHasMore(false)')
  })

  it('the setPlans updater has no side effects', () => {
    const updater = community.match(/setPlans\(prev => \{[\s\S]*?\n {8}\}\)/)?.[0] ?? ''
    expect(updater).not.toMatch(/setHasMore|offsetRef/)
  })

  it('a failed vote is reported', () => {
    const vote = detail.slice(detail.indexOf('const handleVote'), detail.indexOf('const handleShare'))
    expect(vote).toContain("showError(tDetail('voteFailed'))")
    expect(vote).not.toContain('/* 무시 */')
  })

  it('a failed comment list is reported and a late response for another plan is ignored', () => {
    const fetcher = comments.slice(comments.indexOf('const fetchComments'), comments.indexOf('useEffect(() => {'))
    expect(fetcher).toContain("showError(tDetail('commentsLoadFailed'))")
    expect(fetcher).toMatch(/latestRequest\.current === requestId/)
  })

  it('the plan view is counted once per plan per browser session', () => {
    const effect = detail.slice(detail.indexOf('// 조회수 증가'), detail.indexOf('// 추천 상태 확인'))
    expect(effect).toContain('sessionStorage')
    expect(effect).toContain('/view')
  })
})

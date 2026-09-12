import { expect, it } from 'vitest'
import { getAssociationChips } from '@/components/identity/IdentityInfoCard'
it('excludes internal size tags while preserving fixer traits and real affiliations', () => {
  const identity = { unit_keyword_list: ['해결사', '소형', 'SMALL'], association_list: ['새벽 사무소'], affiliation: '새벽 사무소' }
  const labels = getAssociationChips(identity, 'ko')
  expect(labels).toEqual(['해결사', '새벽 사무소'])
  expect(identity.unit_keyword_list).toContain('소형')
})

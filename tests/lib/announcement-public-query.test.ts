import {it,expect,vi} from 'vitest'
const m=vi.hoisted(()=>({eq:vi.fn(),order:vi.fn(),limit:vi.fn()}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({schema:()=>({from:()=>({select:()=>m})})})}))
import {getAnnouncementsForLang} from '@/lib/db/announcements'
it('excludes drafts in the public query and scopes the selected language',async()=>{
 m.eq.mockReturnValue(m);m.order.mockReturnValue(m);m.limit.mockResolvedValue({data:[],error:null})
 await getAnnouncementsForLang('ja');expect(m.eq).toHaveBeenCalledWith('lang','ja');expect(m.eq).toHaveBeenCalledWith('published',true)
})

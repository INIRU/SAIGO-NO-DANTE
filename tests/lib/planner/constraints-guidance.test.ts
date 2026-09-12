import {expect,it} from 'vitest'
import {constraintsForFloor,normalizeConstraints} from '@/lib/planner/constraints'
import {createInitialState,plannerReducer,type GiftData,type RecipeData} from '@/lib/planner/types'
import {encodePlan,decodePlan} from '@/lib/planner/encoder'
import {craftableAtFloor} from '@/lib/planner/floor-guidance'
it('applies each floor pool, prerequisites, removal and plan code round-trip',async()=>{
 expect(constraintsForFloor(10,[])).toEqual([])
 for(let floor=11;floor<=15;floor++)expect(constraintsForFloor(floor,[])).toHaveLength(6)
 expect(constraintsForFloor(12,[]).map(c=>c.id)).toContain(995015)
 expect(constraintsForFloor(12,[995015]).map(c=>c.id)).toContain(995016)
 expect(normalizeConstraints([{floor:11,constraints:[]},{floor:12,constraints:[995016,999999]}])[1].constraints).toEqual([])
 let s=createInitialState('extreme')
 s=plannerReducer(s,{type:'SET_FLOOR_CONSTRAINTS',floor:11,ids:[995015]})
 s=plannerReducer(s,{type:'SET_FLOOR_CONSTRAINTS',floor:12,ids:[995016]})
 s.floorPlan[10].gift_ids=['1001'];s.floorPlan[10].memo='한글 메모';s.description='## 운용\n\n상세 설명'
 const decoded=await decodePlan(await encodePlan(s))
 expect(decoded.floorConstraints[11]).toEqual([995016]);expect(decoded.floorGifts[10]).toEqual(['1001']);expect(decoded.floorMemos[10]).toBe('한글 메모');expect(decoded.description).toBe(s.description)
 s=plannerReducer(s,{type:'SET_FLOOR_CONSTRAINTS',floor:11,ids:[]})
 expect(s.floorPlan[11].constraints).toEqual([])
})
it('only offers final fusions when all real materials have been planned by that floor',()=>{
 const gifts=new Map([1,2,3].map(game_id=>[game_id,{game_id,name:`gift${game_id}`} as GiftData]))
 const recipes=[{id:'r',result_name:'gift3',ingredients:['gift1','gift2']} as RecipeData]
 const entries=[{floor:1,gift_ids:['1']},{floor:2,gift_ids:['2']}]
 expect(craftableAtFloor(1,entries,['final_3'],recipes,gifts)).toHaveLength(0)
 expect(craftableAtFloor(2,entries,['final_3'],recipes,gifts)).toHaveLength(1)
 expect(craftableAtFloor(2,entries,[],recipes,gifts)).toHaveLength(0)
 expect(craftableAtFloor(2,entries,['final_3'],[{...recipes[0],ingredients:['gift1','unknown']}],gifts)).toHaveLength(0)
})

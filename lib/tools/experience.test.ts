import { describe, expect, it } from 'vitest'
import { experienceNeeded, LUXCAVATIONS, optimizeTickets, planLuxcavation, ticketExperience, type Tickets } from './experience'
describe('experience calculator', () => {
  it('matches level milestones and partial progress', () => {
    for (const [level, exp] of [[10,396],[20,6481],[30,36404],[35,61123],[40,91700],[45,129019],[50,166084],[55,206864],[60,251629]]) expect(experienceNeeded(1, level)).toBe(exp)
    expect(experienceNeeded(55, 60, 100)).toBe(44665)
    expect(experienceNeeded(60, 60)).toBe(0)
    expect(experienceNeeded(20, 20, 100)).toBe(0)
  })
  it('rejects invalid levels, partial EXP and inventory', () => {
    for (const args of [[0,60,0],[60,60,1],[30,20,0],[1,2,10],[1,61,0],[1.5,60,0]]) expect(() => experienceNeeded(...args as [number,number,number])).toThrow()
    expect(() => optimizeTickets(20, [-1,0,0,0])).toThrow()
    expect(() => planLuxcavation(20, [0,0,0,0], 10, false)).toThrow()
  })
  it('matches all nine fixed reward totals and rounds skips per ticket', () => {
    expect(LUXCAVATIONS.map(x => ticketExperience(x.tickets))).toEqual([1700,3600,4800,10000,12200,14400,16800,20800,25200])
    expect(LUXCAVATIONS.map(x => planLuxcavation(10,[0,0,0,0],x.stage,true).experience)).toEqual([2650,6000,7200,15000,18400,21600,25200,31200,37800])
  })
  it('plans 1–60 with exact rewards and preserves unused tickets', () => {
    const normal = planLuxcavation(251629,[0,0,0,0],9,false)
    expect([normal.runs,normal.modules,normal.enkephalin]).toEqual([10,30,600])
    expect(normal.plan.used).toEqual([0,59,60,60])
    expect(normal.plan.excess).toBe(171)
    expect(planLuxcavation(251629,[0,0,0,0],9,true).runs).toBe(7)
    expect(planLuxcavation(1000,[0,0,1,0],9,false).runs).toBe(0)
    expect(optimizeTickets(1000,[1,1,0,0]).missing).toBe(750)
  })
  it('minimizes excess then count against exhaustive small inventories', () => {
    for (let seed=0;seed<80;seed++) {
      const stock:Tickets=[seed%5,Math.floor(seed/5)%5,Math.floor(seed/7)%4,Math.floor(seed/11)%3]
      for(const target of [0,1,199,999,1001,2999,3001,6101]) {
        let best=Infinity, count=Infinity
        for(let a=0;a<=stock[0];a++) for(let b=0;b<=stock[1];b++) for(let c=0;c<=stock[2];c++) for(let d=0;d<=stock[3];d++) {
          const exp=ticketExperience([a,b,c,d]); const n=a+b+c+d
          if(exp>=target && (exp<best || exp===best && n<count)) {best=exp;count=n}
        }
        const result=optimizeTickets(target,stock)
        if(best===Infinity) expect(result.used).toEqual(stock)
        else {expect(result.spent).toBe(best);expect(result.used.reduce((a,b)=>a+b,0)).toBe(count)}
      }
    }
  })
})

import {test,expect} from 'bun:test'
import {memoryTokenLabel,memoryWorkLabel} from './memory-activity-prototype'
import type {Status} from './protocol'
const base:Status={count:0,cursor:0,working:false,summaryActive:0,summaryFailed:0,contextBytes:0,viewTotal:0,offset:0,nodes:[]}
test('memory footer reports latest call tokens, preserving zero and missing values',()=>{
 const status:Status={...base,contextCall:{id:'one',observation:{source:'fixture',receivedAt:0,metrics:{last:{input:128000},'context-limit':258400}}}}
 expect(memoryTokenLabel(status)).toBe('Context · last 128.0k input / unavailable new / unavailable cached / 258.4k limit · next unavailable')
 expect(memoryTokenLabel({...base,contextCall:{id:'two',observation:null}})).toBe('Context · last unavailable input / unavailable new / unavailable cached / unavailable limit · next unavailable')
 expect(memoryTokenLabel({...status,contextCall:{id:'zero',observation:{source:'fixture',receivedAt:0,metrics:{last:{input:0}}}}})).toBe('Context · last 0 input / unavailable new / unavailable cached / unavailable limit · next unavailable')
})

import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {engine} from '@opentui/core'
import {MemoryActivityPrototype} from './memory-activity-prototype'
test('summary icon advances explicitly and disappears when Lisp reports idle',async()=>{
 const t=await createTestRenderer({width:240,height:3});const root=createRoot(t.renderer)
 try{
  flushSync(()=>root.render(<MemoryActivityPrototype status={{...base,summaryActive:1,summaryFailed:2}}/>));await t.flush()
  const before=t.captureCharFrame();expect(before).toContain('failed 2');expect(before).not.toContain('summarizing')
  flushSync(()=>engine.update(250));await t.flush();expect(t.captureCharFrame()).not.toBe(before)
  flushSync(()=>root.render(<MemoryActivityPrototype status={base}/>));await t.flush();expect(t.captureCharFrame()).not.toContain('failed');expect(t.captureCharFrame()).not.toContain('◓')
 }finally{flushSync(()=>root.unmount());t.renderer.destroy()}
})

test('fresh-round estimate includes draft during active work',()=>{
 const status:Status={...base,nextBasis:{instructions:40,tools:8,input:80,memory:60}}
 expect(memoryTokenLabel(status)).toBe('Context · last unavailable input / unavailable new / unavailable cached / unavailable limit · next ~32')
 expect(memoryTokenLabel(status,'abcd')).toContain('next ~33')
 expect(memoryTokenLabel({...status,working:true},'abcd')).toContain('next ~33')
})

 test('last reported usage remains identified while a new call has no observation',()=>{
 const observation={source:'fixture',receivedAt:0,metrics:{last:{input:123},'context-limit':456}}
 const status:Status={...base,working:true,contextCall:{id:'new',observation:null,lastReported:{id:'old',observation}}}
 expect(memoryTokenLabel(status)).toContain('last 123 input / unavailable new / unavailable cached / 456 limit')
 expect(memoryTokenLabel({...status,nextBasis:{instructions:40,tools:8,input:40000,memory:39000}},'abcd')).toContain('next ~10.0k')
 })

test('memory work footer distinguishes zero and missing observations',()=>{
 const u={started:2,input:12000,output:0,inputObserved:1,outputObserved:1}
 expect(memoryWorkLabel({...base,memoryUsage:u})).toBe('Memory Σ 12.0k input / unavailable cached / 0 out · partial')
 expect(memoryWorkLabel(base)).toBe('Memory Σ unavailable')
 expect(memoryWorkLabel({...base,memoryUsage:{...u,inputObserved:0,outputObserved:0}})).toContain('unavailable')
})

test("complete cache split",()=>{
 const u={started:2,input:12000,output:0,inputObserved:2,outputObserved:2,cachedInput:10000,cachedInputObserved:2}
 expect(memoryWorkLabel({...base,memoryUsage:u})).toBe("Memory Σ 2.0k new / 10.0k cached / 0 out")
 expect(memoryWorkLabel({...base,memoryUsage:{...u,cachedInputObserved:1}})).toContain("12.0k input")
 expect(memoryWorkLabel({...base,memoryUsage:{...u,input:0,cachedInput:0}})).toBe("Memory Σ 0 new / 0 cached / 0 out")
})

test('last context splits paired counters and preserves zero',()=>{
 const label=(input:number|undefined,cached:number|undefined)=>memoryTokenLabel({...base,contextCall:{id:'split',observation:{source:'fixture',receivedAt:0,metrics:{last:{input,'cached-input':cached}}}}})
 expect(label(12000,10000)).toContain('last 12.0k input / 2.0k new / 10.0k cached')
 expect(label(0,0)).toContain('last 0 input / 0 new / 0 cached')
 expect(label(undefined,10)).toContain('unavailable new / 10 cached')
 expect(label(10,11)).toContain('unavailable new')
 expect(label(10,-1)).toContain('unavailable new / unavailable cached')
})

 test('pending summary retains known subtotals instead of flashing unavailable',()=>{
 const u={started:3,input:12000,output:100,inputObserved:2,outputObserved:2,cachedInput:10000,cachedInputObserved:2}
 const label=memoryWorkLabel({...base,working:true,summaryActive:1,memoryUsage:u})
 expect(label).toBe('Memory Σ 12.0k input / 10.0k cached / 100 out · partial')
 expect(label).not.toContain('Memory Σ unavailable')
 })

import {tokenLabelParts} from './memory-activity-prototype'
import {theme} from './theme'
test('token colors emphasize only new and cached numbers without changing text',()=>{
 const label='Context · last 12.0k input / 2.0k new / 10.0k cached · Memory Σ unavailable / unavailable cached / 0 out · partial'
 const parts=tokenLabelParts(label)
 expect(parts.map(p=>p.text).join('')).toBe(label)
 expect(parts.filter(p=>p.color===theme.tokenNew).map(p=>p.text)).toEqual(['2.0k'])
 expect(parts.filter(p=>p.color===theme.tokenCached).map(p=>p.text)).toEqual(['10.0k'])
 expect(tokenLabelParts('Memory Σ 0 new / 0 cached').filter(p=>p.color!==theme.muted).map(p=>p.text)).toEqual(['0','0'])
})

import {test,expect} from 'bun:test'
import {memoryTokenLabel,memoryWorkLabel} from './memory-activity-prototype'
import type {Status} from './protocol'
const base:Status={count:0,cursor:0,working:false,summaryActive:0,summaryFailed:0,contextBytes:0,viewTotal:0,offset:0,nodes:[]}
test('memory footer reports latest call tokens, preserving zero and missing values',()=>{
 const status:Status={...base,contextCall:{id:'one',observation:{source:'fixture',receivedAt:0,metrics:{last:{input:128000},'context-limit':258400}}}}
 expect(memoryTokenLabel(status)).toBe('Context · last 128.0k / 258.4k · next unavailable')
 expect(memoryTokenLabel({...base,contextCall:{id:'two',observation:null}})).toBe('Context · last unavailable / unavailable · next unavailable')
 expect(memoryTokenLabel({...status,contextCall:{id:'zero',observation:{source:'fixture',receivedAt:0,metrics:{last:{input:0}}}}})).toBe('Context · last 0 / unavailable · next unavailable')
})

import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {engine} from '@opentui/core'
import {MemoryActivityPrototype} from './memory-activity-prototype'
test('summary icon advances explicitly and disappears when Lisp reports idle',async()=>{
 const t=await createTestRenderer({width:120,height:3});const root=createRoot(t.renderer)
 try{
  flushSync(()=>root.render(<MemoryActivityPrototype status={{...base,summaryActive:1,summaryFailed:2}}/>));await t.flush()
  const before=t.captureCharFrame();expect(before).toContain('failed 2');expect(before).not.toContain('summarizing')
  flushSync(()=>engine.update(250));await t.flush();expect(t.captureCharFrame()).not.toBe(before)
  flushSync(()=>root.render(<MemoryActivityPrototype status={base}/>));await t.flush();expect(t.captureCharFrame()).not.toContain('failed');expect(t.captureCharFrame()).not.toContain('◓')
 }finally{flushSync(()=>root.unmount());t.renderer.destroy()}
})

test('fresh-round estimate includes draft during active work',()=>{
 const status:Status={...base,nextBasis:{instructions:40,tools:8,input:80,memory:60}}
 expect(memoryTokenLabel(status)).toBe('Context · last unavailable / unavailable · next ~32')
 expect(memoryTokenLabel(status,'abcd')).toContain('next ~33')
 expect(memoryTokenLabel({...status,working:true},'abcd')).toContain('next ~33')
})

 test('last reported usage remains identified while a new call has no observation',()=>{
 const observation={source:'fixture',receivedAt:0,metrics:{last:{input:123},'context-limit':456}}
 const status:Status={...base,working:true,contextCall:{id:'new',observation:null,lastReported:{id:'old',observation}}}
 expect(memoryTokenLabel(status)).toContain('last 123 / 456')
 expect(memoryTokenLabel({...status,nextBasis:{instructions:40,tools:8,input:40000,memory:39000}},'abcd')).toContain('next ~10.0k')
 })

test('memory work footer distinguishes zero and missing observations',()=>{
 const u={started:2,input:12000,output:0,inputObserved:1,outputObserved:1}
 expect(memoryWorkLabel({...base,memoryUsage:u})).toBe('Memory 12.0k in / 0 out · partial')
 expect(memoryWorkLabel(base)).toBe('Memory unavailable')
 expect(memoryWorkLabel({...base,memoryUsage:{...u,inputObserved:0,outputObserved:0}})).toContain('unavailable')
})

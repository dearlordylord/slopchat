import {test,expect} from 'bun:test'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {MemoryWidget} from './memory-widget'
test('memory widget keeps a fixed height and distinguishes missing from zero',async()=>{
 const t=await createTestRenderer({width:80,height:20});const root=createRoot(t.renderer);
 try{flushSync(()=>root.render(<MemoryWidget status={undefined}/>));await t.flush();expect(t.captureCharFrame()).toContain('Job details unavailable');expect(t.renderer.root.findDescendantById('memory-widget')?.height).toBe(9);
 }finally{flushSync(()=>root.unmount());t.renderer.destroy()}
})

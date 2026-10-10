import {test,expect} from 'bun:test'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {EchoResult,processResult} from './echo-result'
test('process results preserve output and reject unknown envelopes',()=>{
 for(const output of ['', 'literal **text**', 'line\nnext', '"quoted"', 'back\\slash']){
  const raw='(:session-id "process-1" :status "exited" :output '+JSON.stringify(output)+' :dropped-chars 0 :exit-code 0)';
  expect(processResult(raw)?.output).toBe(output);
 }
 expect(processResult('(:output "not a process")')).toBeNull();
 expect(processResult('42')).toBeNull();
})
test('result output is visible once and raw details are reversible',async()=>{
 const t=await createTestRenderer({width:100,height:20});const root=createRoot(t.renderer);
 const text='(:session-id "process-1" :status "exited" :output "literal **result**" :dropped-chars 2 :exit-code 1)';
 try{flushSync(()=>root.render(<EchoResult message={{i:1,kind:'echo',text,size:text.length,date:'now'}}/>));await t.waitForFrame(f=>f.includes('literal **result**'));let frame=t.captureCharFrame();expect(frame).toContain('exit 1');expect(frame).not.toContain(':session-id');const row=t.renderer.root.findDescendantById('echo-details-1');if(!row)throw Error('Missing details');await t.mockMouse.click(row.x+2,row.y);await t.waitForFrame(f=>f.includes(':session-id'));expect(t.captureCharFrame()).toContain(':dropped-chars');await t.mockMouse.click(row.x+2,row.y);await t.waitForFrame(f=>!f.includes(':session-id'));expect(t.captureCharFrame()).toContain('literal **result**')}finally{flushSync(()=>root.unmount());t.renderer.destroy()}
})

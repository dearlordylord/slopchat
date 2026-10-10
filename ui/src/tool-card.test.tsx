import {test,expect} from 'bun:test'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {ToolCard} from './tool-card'
test('tool details expand without losing literal output',async()=>{
 const t=await createTestRenderer({width:100,height:20});const root=createRoot(t.renderer);const tool={callId:'a',name:'eval',expression:'(+ 1 2)',state:'running'};const message={i:0,kind:'tool',text:'raw',size:3,date:'now',tool};const result={...message,i:1,kind:'echo',text:'literal **result**',tool:{...tool,state:'completed'}};
 try{flushSync(()=>root.render(<ToolCard message={message} result={result}/>));await t.waitForFrame(f=>f.includes('completed'));expect(t.captureCharFrame()).not.toContain('literal **result**');const row=t.renderer.root.findDescendantById('tool-0');if(!row)throw Error('Missing row');await t.mockMouse.pressDown(row.x,row.y);await t.mockMouse.release(row.x,row.y);await t.waitForFrame(f=>f.includes('Expression'));expect(t.captureCharFrame()).toContain('(+ 1 2)');await t.flush();t.renderer.clearSelection();await t.mockMouse.pressDown(row.x+20,row.y);await t.mockMouse.release(row.x+20,row.y);await t.waitForFrame(f=>!f.includes('Expression'));expect(t.captureCharFrame()).toContain('▶ eval');expect(t.captureCharFrame()).not.toContain('Enter/click');expect(t.captureCharFrame()).not.toContain('Details')}finally{flushSync(()=>root.unmount());t.renderer.destroy()}
})

test('large tool expressions read bounded canonical pages',async()=>{
 const {makeClient}=await import('./client');const Registry=await import('effect/reactivity/AtomRegistry');const {Effect}=await import('effect');
 const t=await createTestRenderer({width:100,height:20,kittyKeyboard:true});const root=createRoot(t.renderer);const registry=Registry.make();const client=makeClient('/tmp/tool-pages',registry);const requests:object[]=[];
 client.inspect=p=>Effect.sync(()=>{requests.push(p);const offset='offset' in p?Number(p.offset):0;return {value:{offset,end:offset+2000,total:4000,text:offset===0?'first canonical page':'second canonical page'}}});
 const message={i:7,kind:'tool',text:'fragment',size:8,date:'now',tool:{callId:'large',name:'eval',state:'running',expression:'preview',expressionTruncated:true}};
 try{
  flushSync(()=>root.render(<ToolCard message={message} client={client}/>));await t.waitForFrame(f=>f.includes('eval'));const row=t.renderer.root.findDescendantById('tool-7');if(!row)throw Error('Missing tool row');await t.mockMouse.pressDown(row.x,row.y);await t.mockMouse.release(row.x,row.y);await t.waitForFrame(f=>f.includes('first canonical page'));
  row.parent?.focus();flushSync(()=>t.mockInput.pressArrow('right'));await t.waitForFrame(f=>f.includes('second canonical page'));expect(requests).toEqual([{action:'tool-expression',id:7,offset:0},{action:'tool-expression',id:7,offset:2000}]);
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

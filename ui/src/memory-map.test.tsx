import {Effect} from 'effect'
import {test,expect} from 'bun:test'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {RegistryContext} from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import {App} from './app'
import {makeClient} from './client'
import {makeViewSession} from './view-session'
import {pinHostAtoms} from './host-atoms'
import {statusAtom} from './state'
import type {ScrollBoxRenderable} from '@opentui/core'
test('keyboard wrap scrolls selected memory block into viewport',async()=>{
 const t=await createTestRenderer({width:60,height:24,kittyKeyboard:true});const registry=Registry.make();const release=pinHostAtoms(registry);const client=makeClient('/tmp/unused-map',registry);const session=makeViewSession();const root=createRoot(t.renderer);
 const wait=(p:()=>boolean)=>t.waitFor(p);
 try{registry.set(statusAtom,{count:20,cursor:20,working:false,summaryActive:0,summaryFailed:0,contextBytes:100,viewTotal:20,offset:0,nodes:Array.from({length:20},(_,id)=>({id,n:1,text:'Block '+id+' '+('wrapped content '.repeat(12))}))});flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client} session={session}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('SLOPCHAT'));flushSync(()=>t.mockInput.pressKey('o',{ctrl:true}));await wait(()=>!!t.renderer.root.findDescendantById('memory-map')&&!session.focus);flushSync(()=>t.mockInput.pressArrow('down',{shift:true}));await wait(()=>session.selected===5);flushSync(()=>t.mockInput.pressArrow('down',{shift:true}));await wait(()=>session.selected===10);flushSync(()=>t.mockInput.pressArrow('up',{shift:true}));await wait(()=>session.selected===5);flushSync(()=>t.mockInput.pressArrow('up',{shift:true}));await wait(()=>session.selected===0);flushSync(()=>t.mockInput.pressArrow('up'));await wait(()=>session.selected===19);const box=t.renderer.root.findDescendantById('memory-map') as ScrollBoxRenderable;await wait(()=>{const child=box.content.findDescendantById('memory-block-19');return !!child&&child.y>=box.viewport.y&&child.y<box.viewport.y+box.viewport.height});expect(box.scrollTop).toBeGreaterThan(0);flushSync(()=>t.mockInput.pressArrow('down'));await wait(()=>session.selected===0);await wait(()=>{const child=box.content.findDescendantById('memory-block-0');return !!child&&child.y>=box.viewport.y&&child.y<box.viewport.y+box.viewport.height})}finally{flushSync(()=>root.unmount());await client.close();release();registry.dispose();t.renderer.destroy()}
})

test('source lens stays local and preserves its draft',async()=>{
 const t=await createTestRenderer({width:100,height:35,kittyKeyboard:true});const registry=Registry.make();const release=pinHostAtoms(registry);const client=makeClient('/tmp/unused-lens',registry);const session=makeViewSession();const requests:object[]=[];
 client.inspect=p=>{requests.push(p);return Effect.succeed({value:{id:0,kind:'user',text:'Exact original',page:0,pages:1,date:'now'}})};
 const root=createRoot(t.renderer);
 try{registry.set(statusAtom,{count:1,cursor:1,working:false,summaryActive:0,summaryFailed:0,contextBytes:10,viewTotal:1,offset:0,nodes:[{id:0,n:1,text:'original'}]});flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client} session={session}/></RegistryContext.Provider>));await t.flush();await t.mockInput.pasteBracketedText('/source 0');flushSync(()=>t.mockInput.pressEnter());await t.waitFor(()=>!!t.renderer.root.findDescendantById('source-lens'));await t.flush();flushSync(()=>t.mockInput.pressEnter());await t.waitForFrame(f=>f.includes('Exact original'));expect(requests).toEqual([{action:'zoom',id:0,n:1,page:0}]);flushSync(()=>t.mockInput.pressEscape());await t.flush();flushSync(()=>t.mockInput.pressEscape());await t.waitFor(()=>!t.renderer.root.findDescendantById('source-lens'));expect(session.draft).toBe('/source 0');expect(requests).toHaveLength(1)}finally{flushSync(()=>root.unmount());await client.close();release();registry.dispose();t.renderer.destroy()}
})

 test('map browses summary children and paged originals without sending',async()=>{
 const t=await createTestRenderer({width:100,height:35,kittyKeyboard:true});const registry=Registry.make();const release=pinHostAtoms(registry);const client=makeClient('/tmp/unused-map-sources',registry);const session=makeViewSession();session.draft='Retained draft';const requests:object[]=[];
 client.inspect=p=>{requests.push(p);const a=p as {n:number;id:number;page:number};return Effect.succeed({value:a.n===4?[{l:1,i:0,text:'Child summary'},{l:1,i:1,text:'Second summary'}]:a.n===2?[{l:0,i:0,text:'First leaf'},{l:0,i:1,text:'Second leaf'}]:{id:a.id,kind:'user',text:'Original page '+a.page,page:a.page,pages:2,date:'now'}})};
 const root=createRoot(t.renderer);
 try{registry.set(statusAtom,{count:4,cursor:4,working:false,summaryActive:0,summaryFailed:0,contextBytes:10,viewTotal:1,offset:0,nodes:[{id:0,n:4,text:'Root summary'}]});flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client} session={session}/></RegistryContext.Provider>));await t.flush();flushSync(()=>t.mockInput.pressKey('o',{ctrl:true}));await t.waitFor(()=>!!t.renderer.root.findDescendantById('memory-map')&&!session.focus);
 for(const text of ['Child summary','First leaf','Original page 0']){flushSync(()=>t.mockInput.pressEnter());await t.waitForFrame(f=>f.includes(text))}
 flushSync(()=>t.mockInput.pressArrow('right'));await t.waitForFrame(f=>f.includes('Original page 1'));
 expect(requests).toEqual([{action:'zoom',id:0,n:4,page:0},{action:'zoom',id:0,n:2,page:0},{action:'zoom',id:0,n:1,page:0},{action:'zoom',id:0,n:1,page:1}]);
 for(let i=0;i<4;i++){flushSync(()=>t.mockInput.pressEscape());await t.flush()}
 await t.waitFor(()=>!t.renderer.root.findDescendantById('memory-map'));expect(session.draft).toBe('Retained draft');expect(session.focus).toBe(true);expect(requests).toHaveLength(4);
 }finally{flushSync(()=>root.unmount());await client.close();release();registry.dispose();t.renderer.destroy()}
 })

 test('map compares exact parent and child coverage without sending',async()=>{
 const t=await createTestRenderer({width:100,height:35,kittyKeyboard:true});const registry=Registry.make();const release=pinHostAtoms(registry);const client=makeClient('/tmp/unused-map-sources',registry);const session=makeViewSession();session.draft='Retained draft';const requests:object[]=[];
 client.inspect=p=>{requests.push(p);const a=p as {n:number;id:number;page:number};return Effect.succeed({value:a.n===4?[{l:1,i:0,text:'Child summary'},{l:1,i:1,text:'Second summary'}]:a.n===2?[{l:0,i:0,text:'First leaf'},{l:0,i:1,text:'Second leaf'}]:{id:a.id,kind:'user',text:'Original page '+a.page,page:a.page,pages:2,date:'now'}})};
 const root=createRoot(t.renderer);
 try{registry.set(statusAtom,{count:4,cursor:4,working:false,summaryActive:0,summaryFailed:0,contextBytes:10,viewTotal:1,offset:0,nodes:[{id:0,n:4,text:'Root summary'}]});flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client} session={session}/></RegistryContext.Provider>));await t.flush();flushSync(()=>t.mockInput.pressKey('o',{ctrl:true}));await t.waitFor(()=>!!t.renderer.root.findDescendantById('memory-map')&&!session.focus);
 flushSync(()=>t.mockInput.pressKey('c'));await t.waitForFrame(f=>f.includes('Compare compaction (read-only)'));
 expect(requests).toEqual([{action:'zoom',id:0,n:4,page:0}]);
 await t.waitForFrame(f=>f.includes('PARENT 0..3')&&f.includes('CHILD 1 0..1')&&f.includes('CHILD 2 2..3'));
 expect(session.draft).toBe('Retained draft');
 flushSync(()=>t.mockInput.pressEscape());await t.waitFor(()=>!t.renderer.root.findDescendantById('compaction-comparison'));
 expect(t.renderer.root.findDescendantById('memory-map')).toBeDefined();expect(requests).toHaveLength(1);
 }finally{flushSync(()=>root.unmount());await client.close();release();registry.dispose();t.renderer.destroy()}
 })

test('comparison rejects missing and non-partitioning children',async()=>{
 for(const children of [[],[{l:1,i:1,text:'Wrong first child'},{l:1,i:2,text:'Wrong second child'}]]){
 const t=await createTestRenderer({width:80,height:24,kittyKeyboard:true});const registry=Registry.make();const release=pinHostAtoms(registry);const client=makeClient('/tmp/unused-invalid-comparison',registry);const session=makeViewSession();session.draft='Keep draft';let requests=0;
 client.inspect=()=>{requests++;return Effect.succeed({value:children})};const root=createRoot(t.renderer);
 try{registry.set(statusAtom,{count:4,cursor:4,working:false,summaryActive:0,summaryFailed:0,contextBytes:10,viewTotal:1,offset:0,nodes:[{id:0,n:4,text:'Parent'}]});flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client} session={session}/></RegistryContext.Provider>));await t.flush();flushSync(()=>t.mockInput.pressKey('o',{ctrl:true}));await t.waitFor(()=>!!t.renderer.root.findDescendantById('memory-map')&&!session.focus);flushSync(()=>t.mockInput.pressKey('c'));await t.waitForFrame(f=>f.includes('Child coverage unavailable'));expect(t.renderer.root.findDescendantById('compaction-comparison')).toBeUndefined();expect(requests).toBe(1);expect(session.draft).toBe('Keep draft');flushSync(()=>t.mockInput.pressEscape());await t.waitFor(()=>!t.renderer.root.findDescendantById('memory-map'));expect(session.draft).toBe('Keep draft')}
 finally{flushSync(()=>root.unmount());await client.close();release();registry.dispose();t.renderer.destroy()}
 }
})

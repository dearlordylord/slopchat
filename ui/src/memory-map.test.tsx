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
 const wait=async(p:()=>boolean)=>{const end=Date.now()+2000;while(!p()&&Date.now()<end){await t.flush();await new Promise(r=>setTimeout(r,10))}expect(p()).toBe(true)};
 try{registry.set(statusAtom,{count:20,cursor:20,working:false,summaryActive:0,summaryFailed:0,contextBytes:100,viewTotal:20,offset:0,nodes:Array.from({length:20},(_,id)=>({id,n:1,text:'Block '+id+' '+('wrapped content '.repeat(12))}))});flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client} session={session}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('SLOPCHAT'));t.mockInput.pressKey('o',{ctrl:true});await wait(()=>!!t.renderer.root.findDescendantById('memory-map')&&!session.focus);t.mockInput.pressArrow('up');await wait(()=>session.selected===19);const box=t.renderer.root.findDescendantById('memory-map') as ScrollBoxRenderable;await wait(()=>{const child=box.content.findDescendantById('memory-block-19');return !!child&&child.y>=box.viewport.y&&child.y<box.viewport.y+box.viewport.height});expect(box.scrollTop).toBeGreaterThan(0);t.mockInput.pressArrow('down');await wait(()=>session.selected===0);await wait(()=>{const child=box.content.findDescendantById('memory-block-0');return !!child&&child.y>=box.viewport.y&&child.y<box.viewport.y+box.viewport.height})}finally{flushSync(()=>root.unmount());await client.close();release();registry.dispose();t.renderer.destroy()}
})

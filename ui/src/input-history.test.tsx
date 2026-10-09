import {test,expect} from 'bun:test'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {RegistryContext} from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import {Effect} from 'effect'
import {App} from './app'
import {makeClient} from './client'
import {makeViewSession} from './view-session'
import type {TextareaRenderable} from '@opentui/core'
test('boundary recall restores draft; Tab queues without changing focus',async()=>{
 const t=await createTestRenderer({width:120,height:40,kittyKeyboard:true,exitOnCtrlC:false});const registry=Registry.make();const client=makeClient('/tmp/unused-history',registry);const session=makeViewSession();session.inputHistory=['older','latest'];const requests:object[]=[];client.inspect=p=>Effect.sync(()=>{requests.push(p);return {status:'accepted'}});const root=createRoot(t.renderer);
 const wait=async(p:()=>boolean)=>{const end=Date.now()+2000;while(!p()&&Date.now()<end){await t.flush();await new Promise(r=>setTimeout(r,10))}expect(p()).toBe(true)};
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client} session={session}/></RegistryContext.Provider>));await t.flush();await new Promise(r=>setTimeout(r,30));const e=t.renderer.root.findDescendantById('composer') as TextareaRenderable;await t.mockInput.pasteBracketedText('draft');t.mockInput.pressArrow('up');await wait(()=>e.plainText==='latest');t.mockInput.pressArrow('up');await wait(()=>e.plainText==='older');t.mockInput.pressArrow('down');await wait(()=>e.plainText==='latest');t.mockInput.pressArrow('down');await wait(()=>e.plainText==='draft');e.setText('top\nbottom');e.cursorOffset=4;t.mockInput.pressArrow('up');await t.flush();expect(e.plainText).toBe('top\nbottom');e.cursorOffset=0;t.mockInput.pressArrow('down');await t.flush();expect(e.plainText).toBe('top\nbottom');e.setText('queued');t.mockInput.pressTab();await wait(()=>requests.length===1&&e.plainText==='');expect(requests).toEqual([{action:'send',text:'queued',ack:true,queue:true}]);expect(session.focus).toBe(true);expect(session.inputHistory.at(-1)).toBe('queued');t.mockInput.pressEscape();await wait(()=>requests.length===2);expect(requests[1]).toEqual({action:'cancel'});expect(e.plainText).toBe('');
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

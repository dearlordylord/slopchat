import {test,expect} from 'bun:test'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {RegistryContext} from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import {App} from './app'
import {makeClient} from './client'
import {pinHostAtoms} from './host-atoms'
import {statusAtom,messagesAtom} from './state'
test('stream preview updates in place and final history replaces it',async()=>{
 const t=await createTestRenderer({width:120,height:40});const registry=Registry.make();const release=pinHostAtoms(registry);const client=makeClient('/tmp/unused-stream',registry);const root=createRoot(t.renderer);
 const base={count:0,cursor:0,working:true,summaryActive:0,summaryFailed:0,contextBytes:0,viewTotal:0,offset:0,nodes:[]};
 try{registry.set(statusAtom,{...base,stream:{text:'Hello',state:'streaming'}});flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('streaming:') && f.includes('Hello'));const preview=t.renderer.root.findDescendantById('agent-stream');registry.set(statusAtom,{...base,stream:{text:'Hello world',state:'streaming'}});await t.waitForFrame(f=>f.includes('Hello world'));expect(t.renderer.root.findDescendantById('agent-stream')).toBe(preview);registry.set(messagesAtom,[{i:0,kind:'slopchat',text:'Hello world',size:11,date:'now'}]);registry.set(statusAtom,{...base,working:false,stream:null});await t.waitForFrame(f=>f.includes('0 slopchat') && f.includes('Hello world') && !f.includes('streaming:'));expect(t.renderer.root.findDescendantById('agent-stream')).toBeUndefined();expect(registry.get(messagesAtom)).toHaveLength(1)}finally{flushSync(()=>root.unmount());await client.close();release();registry.dispose();t.renderer.destroy()}
})

test('long replies remain readable directly in chat',async()=>{
 const t=await createTestRenderer({width:80,height:24});const registry=Registry.make();const release=pinHostAtoms(registry);const client=makeClient('/tmp/unused-long-reply',registry);const root=createRoot(t.renderer);
 const text='Long reply '.repeat(500)+'END OF COMPLETE REPLY';
 try{registry.set(messagesAtom,[{i:0,kind:'slopchat',text,size:text.length,date:'now'}]);flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('END OF COMPLETE REPLY'));expect(t.captureCharFrame()).not.toContain('[truncated: use zoom]');expect(registry.get(messagesAtom)[0]?.text).toBe(text)}finally{flushSync(()=>root.unmount());await client.close();release();registry.dispose();t.renderer.destroy()}
})

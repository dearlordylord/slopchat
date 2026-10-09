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
 try{registry.set(statusAtom,{...base,stream:{text:'Hello',state:'streaming'}});flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('streaming: Hello'));const preview=t.renderer.root.findDescendantById('agent-stream');registry.set(statusAtom,{...base,stream:{text:'Hello world',state:'streaming'}});await t.waitForFrame(f=>f.includes('Hello world'));expect(t.renderer.root.findDescendantById('agent-stream')).toBe(preview);registry.set(messagesAtom,[{i:0,kind:'slopchat',text:'Hello world',size:11,date:'now'}]);registry.set(statusAtom,{...base,working:false,stream:null});await t.waitForFrame(f=>f.includes('0 slopchat Hello world')&&!f.includes('streaming:'));expect(t.renderer.root.findDescendantById('agent-stream')).toBeUndefined();expect(registry.get(messagesAtom)).toHaveLength(1)}finally{flushSync(()=>root.unmount());await client.close();release();registry.dispose();t.renderer.destroy()}
})

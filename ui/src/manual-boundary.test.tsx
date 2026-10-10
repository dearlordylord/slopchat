import {test,expect} from 'bun:test'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {RegistryContext} from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import {ManualBoundary,type View} from './manual-boundary'
import {makeClient} from './client'
import {makeViewSession} from './view-session'
import * as atoms from './state'
import {App} from './app'
test('explicit reload commits and rejects a broken view',async()=>{
 const t=await createTestRenderer({width:120,height:40});const registry=Registry.make();const client=makeClient('/tmp/absent',registry);const session=makeViewSession();const root=createRoot(t.renderer);let apply:(view:View)=>Promise<void>=async()=>{throw Error('not ready')};
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><ManualBoundary host={{client,session,atoms}} register={f=>{apply=f}}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('SLOPCHAT'));await t.mockInput.pasteBracketedText('retained draft');await t.flush();await apply(App);await t.flush();expect(session.editor?.plainText).toBe('retained draft');const broken:View=()=>{throw Error('candidate failed')};await expect(apply(broken)).rejects.toThrow('candidate failed');await t.waitForFrame(f=>f.includes('SLOPCHAT'));expect(session.editor?.plainText).toBe('retained draft');await apply(App);await t.flush();expect(session.editor?.plainText).toBe('retained draft')}finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

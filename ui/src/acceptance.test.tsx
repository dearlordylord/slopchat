import {signal} from './context-test-signal'
import {useState} from 'react'
import {test,expect} from 'bun:test'
import {createServer} from 'node:net'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {RegistryContext} from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import {makeClient} from './client'
import {App} from './app'
import {makeViewSession} from './view-session'
import type {TextareaRenderable} from '@opentui/core'
test('acceptance clears before deferred completion and permits steering',async()=>{
 const socket='/tmp/slopchat-accept-'+process.pid+'.sock';const inputs:string[]=[];let completed=false;let accept:()=>void=()=>{};let received=signal();
 const server=createServer(c=>{c.setEncoding('utf8');c.once('data',d=>{const r=JSON.parse(String(d));inputs.push(r.text);received.complete();expect(r.ack).toBe(true);accept=()=>c.write(JSON.stringify({status:'accepted',value:inputs.length})+'\n')})});
 await new Promise<void>(resolve=>server.listen(socket,resolve));
 const t=await createTestRenderer({width:120,height:40,kittyKeyboard:true});const registry=Registry.make();const client=makeClient(socket,registry);const session=makeViewSession();let swap:()=>void=()=>{};function Boundary(){const [key,setKey]=useState(1);swap=()=>setKey(2);return <App key={key} client={client} session={session}/>};const root=createRoot(t.renderer);
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><Boundary/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('SLOPCHAT'));const editor=t.renderer.root.findDescendantById('composer') as TextareaRenderable;
 await t.mockInput.pasteBracketedText('original');t.mockInput.pressEnter();await received.promise;expect(editor.plainText).toBe('original');flushSync(()=>swap());await t.flush();const swapped=t.renderer.root.findDescendantById('composer') as TextareaRenderable;expect(swapped).not.toBe(editor);expect(editor.isDestroyed).toBe(true);expect(inputs).toEqual(['original']);const accepted=signal();const unsubscribe=session.subscribe(()=>{if(session.result.startsWith('Accepted')){unsubscribe();accepted.complete()}});accept();await accepted.promise;flushSync(()=>{});await t.waitFor(()=>swapped.plainText==='');await t.waitForFrame(f=>f.includes('Accepted'));expect(completed).toBe(false);expect(swapped.height).toBe(1);
 received=signal();await t.mockInput.pasteBracketedText('steer');t.mockInput.pressEnter();await received.promise;await t.mockInput.pasteBracketedText(' next draft');const steered=signal();const stop=session.subscribe(()=>{if(session.result.startsWith('Accepted')){stop();steered.complete()}});accept();await steered.promise;flushSync(()=>{});await t.waitForFrame(f=>f.includes('Accepted'));await t.flush();expect(swapped.plainText).toBe('steer next draft');expect(inputs).toEqual(['original','steer']);completed=true;
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})

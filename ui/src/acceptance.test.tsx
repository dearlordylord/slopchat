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
async function externalWait(predicate:()=>boolean,flush:()=>Promise<void>){const deadline=performance.now()+3000;while(performance.now()<deadline){await flush();if(predicate())return;await Bun.sleep(10)}throw new Error('Socket acceptance deadline exceeded')}
test('acceptance clears before deferred completion and permits steering',async()=>{
 const socket='/tmp/slopchat-accept-'+process.pid+'.sock';const inputs:string[]=[];let completed=false;let accept:()=>void=()=>{};
 const server=createServer(c=>{c.setEncoding('utf8');c.once('data',d=>{const r=JSON.parse(String(d));inputs.push(r.text);expect(r.ack).toBe(true);accept=()=>c.write(JSON.stringify({status:'accepted',value:inputs.length})+'\n')})});
 await new Promise<void>(resolve=>server.listen(socket,resolve));
 const t=await createTestRenderer({width:120,height:40,kittyKeyboard:true});const registry=Registry.make();const client=makeClient(socket,registry);const session=makeViewSession();let swap:()=>void=()=>{};function Boundary(){const [key,setKey]=useState(1);swap=()=>setKey(2);return <App key={key} client={client} session={session}/>};const root=createRoot(t.renderer);
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><Boundary/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('SLOPCHAT'));const editor=t.renderer.root.findDescendantById('composer') as TextareaRenderable;
 await t.mockInput.pasteBracketedText('original');t.mockInput.pressEnter();await externalWait(()=>inputs.length===1,()=>t.flush());expect(editor.plainText).toBe('original');flushSync(()=>swap());await t.flush();const swapped=t.renderer.root.findDescendantById('composer') as TextareaRenderable;expect(swapped).not.toBe(editor);expect(editor.isDestroyed).toBe(true);expect(inputs).toEqual(['original']);accept();await externalWait(()=>swapped.plainText==='',()=>t.flush());await externalWait(()=>t.captureCharFrame().includes('Accepted'),()=>t.flush());expect(completed).toBe(false);expect(swapped.height).toBe(1);
 await t.mockInput.pasteBracketedText('steer');t.mockInput.pressEnter();await externalWait(()=>inputs.length===2,()=>t.flush());await t.mockInput.pasteBracketedText(' next draft');accept();await externalWait(()=>t.captureCharFrame().includes('Accepted'),()=>t.flush());await t.flush();expect(swapped.plainText).toBe('steer next draft');expect(inputs).toEqual(['original','steer']);completed=true;
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})

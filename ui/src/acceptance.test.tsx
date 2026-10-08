import {test,expect} from 'bun:test'
import {createServer} from 'node:net'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {RegistryContext} from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import {makeClient} from './client'
import {App} from './app'
import type {TextareaRenderable} from '@opentui/core'
test('acceptance clears before deferred completion and permits steering',async()=>{
 const socket='/tmp/slopchat-accept-'+process.pid+'.sock';const inputs:string[]=[];let completed=false;let accept:()=>void=()=>{};
 const server=createServer(c=>{c.setEncoding('utf8');c.once('data',d=>{const r=JSON.parse(String(d));inputs.push(r.text);expect(r.ack).toBe(true);accept=()=>c.write(JSON.stringify({status:'accepted',value:inputs.length})+'\n')})});
 await new Promise<void>(resolve=>server.listen(socket,resolve));
 const t=await createTestRenderer({width:120,height:40,kittyKeyboard:true});const registry=Registry.make();const client=makeClient(socket,registry);const root=createRoot(t.renderer);
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('SLOPCHAT'));const editor=t.renderer.root.findDescendantById('composer') as TextareaRenderable;
 await t.mockInput.pasteBracketedText('original');t.mockInput.pressEnter();await t.waitFor(()=>inputs.length===1);expect(editor.plainText).toBe('original');accept();await t.waitFor(()=>editor.plainText==='');expect(completed).toBe(false);expect(editor.height).toBe(1);
 await t.mockInput.pasteBracketedText('steer');t.mockInput.pressEnter();await t.waitFor(()=>inputs.length===2);await t.mockInput.pasteBracketedText(' next draft');accept();await t.waitForFrame(f=>f.includes('Accepted'));await t.flush();expect(editor.plainText).toBe('steer next draft');expect(inputs).toEqual(['original','steer']);completed=true;
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})

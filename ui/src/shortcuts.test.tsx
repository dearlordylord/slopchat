import {test,expect} from 'bun:test'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {RegistryContext} from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import {Effect} from 'effect'
import {makeClient} from './client'
import {App} from './app'
import {statusAtom} from './state'
test('composer Enter sends, Ctrl+Enter and Ctrl+J newline, memory Enter zoom',async()=>{
 const t=await createTestRenderer({width:120,height:40,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/unused-shortcuts.sock',registry);const sent:string[]=[];const inspected:unknown[]=[];
 client.send=(text)=>Effect.sync(()=>{sent.push(text);return {ok:true}});client.inspect=(request)=>Effect.sync(()=>{inspected.push(request);return {zoom:'done'}});
 const root=createRoot(t.renderer);
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('SLOPCHAT'));
 expect(t.renderer.root.findDescendantById('composer')?.height).toBe(1);await t.mockInput.pasteBracketedText('first');t.mockInput.pressEnter({ctrl:true});await t.flush();expect(sent).toEqual([]);expect(t.renderer.root.findDescendantById('composer')?.height).toBe(2);t.mockInput.pressBackspace();await t.waitFor(()=>t.renderer.root.findDescendantById('composer')?.height===1);expect(t.renderer.root.findDescendantById('composer')?.height).toBe(1);t.mockInput.pressEnter({ctrl:true});await t.flush();await t.mockInput.pasteBracketedText('second');t.mockInput.pressEnter();await t.waitFor(()=>sent.length===1);expect(sent).toEqual(['first\nsecond']);await t.waitForFrame(f=>f.includes('Enter send / Ctrl+Enter newline'));
 await t.mockInput.pasteBracketedText('third');t.mockInput.pressKey('j',{ctrl:true});await t.mockInput.pasteBracketedText('fourth');t.mockInput.pressKey('g',{ctrl:true});await t.waitFor(()=>sent.length===2);expect(sent[1]).toBe('third\nfourth');await t.flush();
registry.set(statusAtom,{count:1,cursor:1,working:false,summaryActive:0,summaryFailed:0,contextBytes:0,viewTotal:1,offset:0,nodes:[{id:0,n:1,text:'memory'}]});;
 t.mockInput.pressTab();await t.flush();t.mockInput.pressEnter();await t.waitFor(()=>inspected.length===1);expect(inspected).toEqual([{action:'zoom',id:0,n:1,page:0}]);expect(sent.length).toBe(2);
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

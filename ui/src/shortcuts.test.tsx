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
 client.send=(text)=>Effect.sync(()=>{sent.push(text);return {ok:true}});client.inspect=(request)=>Effect.sync(()=>{inspected.push(request);return ('action' in request && request.action==='models')?{value:{selected:null,models:[{model:'test-model',displayName:'Test model'}]}}:{zoom:'done'}});
 const root=createRoot(t.renderer);
 const waitReal=async(predicate:()=>boolean)=>{const deadline=Date.now()+3000;while(!predicate()&&Date.now()<deadline){await t.flush();await new Promise(r=>setTimeout(r,10))}expect(predicate()).toBe(true)};
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('SLOPCHAT'));
 const mouseBefore=t.renderer.useMouse;t.mockInput.pressKey('y',{ctrl:true});await waitReal(()=>t.renderer.useMouse!==mouseBefore);expect(t.renderer.useMouse).toBe(!mouseBefore);t.mockInput.pressKey('y',{ctrl:true});await waitReal(()=>t.renderer.useMouse===mouseBefore);expect(t.renderer.useMouse).toBe(mouseBefore);expect(sent).toEqual([]);
 expect(t.renderer.root.findDescendantById('composer')?.height).toBe(1);await t.mockInput.pasteBracketedText('first');t.mockInput.pressEnter({ctrl:true});await t.flush();expect(sent).toEqual([]);expect(t.renderer.root.findDescendantById('composer')?.height).toBe(2);t.mockInput.pressBackspace();await t.waitFor(()=>t.renderer.root.findDescendantById('composer')?.height===1);expect(t.renderer.root.findDescendantById('composer')?.height).toBe(1);t.mockInput.pressEnter({ctrl:true});await t.flush();await t.mockInput.pasteBracketedText('second');t.mockInput.pressEnter();await t.waitFor(()=>sent.length===1);expect(sent).toEqual(['first\nsecond']);await t.waitForFrame(f=>f.includes('Enter send / Ctrl+Enter newline'));
 await t.mockInput.pasteBracketedText('third');t.mockInput.pressKey('j',{ctrl:true});await t.mockInput.pasteBracketedText('fourth');t.mockInput.pressKey('g',{ctrl:true});await t.waitFor(()=>sent.length===2);expect(sent[1]).toBe('third\nfourth');await t.flush();
registry.set(statusAtom,{count:1,cursor:1,working:false,summaryActive:0,summaryFailed:0,contextBytes:0,viewTotal:1,offset:0,nodes:[{id:0,n:1,text:'memory'}]});;
 t.mockInput.pressKey('f',{ctrl:true});await t.flush();t.mockInput.pressEnter();await t.waitFor(()=>inspected.length===1);expect(inspected).toEqual([{action:'zoom',id:0,n:1,page:0}]);expect(sent.length).toBe(2); t.mockInput.pressKey('o',{ctrl:true});await waitReal(()=>!!t.renderer.root.findDescendantById('memory-map'));expect(t.renderer.root.findDescendantById('memory-map')).toBeDefined();t.mockInput.pressKey('o',{ctrl:true});await waitReal(()=>!!t.renderer.root.findDescendantById('history'));expect(sent.length).toBe(2);await t.flush();await new Promise(r=>setTimeout(r,20));await t.mockInput.pasteBracketedText('/ma');await waitReal(()=>t.captureCharFrame().includes('Commands: /map'));t.mockInput.pressTab();await t.flush();t.mockInput.pressEnter();await waitReal(()=>!!t.renderer.root.findDescendantById('memory-map'));expect(sent.length).toBe(2);t.mockInput.pressEscape();await waitReal(()=>!!t.renderer.root.findDescendantById('history'));expect(sent.length).toBe(2);
 await t.mockInput.pasteBracketedText('/models');t.mockInput.pressEnter();await waitReal(()=>!!t.renderer.root.findDescendantById('model-picker'));t.mockInput.pressArrow('down');await t.flush();await new Promise(r=>setTimeout(r,20));t.mockInput.pressEnter();await waitReal(()=>!t.renderer.root.findDescendantById('model-picker'));expect(inspected.at(-1)).toEqual({action:'model',model:'test-model'});expect(sent.length).toBe(2);
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

// Slash commands are local UI actions, never chat sends.

test('Ctrl+C clears, confirms, expires; Ctrl+Q does not exit',async()=>{
 const t=await createTestRenderer({width:120,height:40,kittyKeyboard:true,exitOnCtrlC:false});const registry=Registry.make();const client=makeClient('/tmp/unused-cancel.sock',registry);const root=createRoot(t.renderer);let destroyed=false;t.renderer.on('destroy',()=>{destroyed=true});
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('SLOPCHAT'));
 const frame=t.captureCharFrame();expect(frame).not.toContain('Ctrl+Q');expect(frame).not.toContain('Ctrl+J');expect(frame).not.toContain('Ctrl+G');
 await t.mockInput.pasteBracketedText('  ');t.mockInput.pressKey('c',{ctrl:true});await t.flush();expect((t.renderer.root.findDescendantById('composer') as import('@opentui/core').TextareaRenderable).plainText).toBe('');expect(destroyed).toBe(false);expect(t.captureCharFrame()).not.toContain('ctrl+c again for exit');
 t.mockInput.pressKey('q',{ctrl:true});await t.flush();expect(destroyed).toBe(false);
 await new Promise(r=>setTimeout(r,30));t.mockInput.pressKey('c',{ctrl:true});await new Promise(r=>setTimeout(r,30));await t.waitForFrame(f=>f.includes('ctrl+c again for exit'));await new Promise(r=>setTimeout(r,1100));await t.flush();expect(t.captureCharFrame()).not.toContain('ctrl+c again for exit');expect(destroyed).toBe(false);
 await new Promise(r=>setTimeout(r,30));t.mockInput.pressKey('c',{ctrl:true});await new Promise(r=>setTimeout(r,30));await t.waitForFrame(f=>f.includes('ctrl+c again for exit'));t.mockInput.pressKey('c',{ctrl:true});await new Promise(r=>setTimeout(r,30));expect(destroyed).toBe(true);
 }finally{if(!destroyed)flushSync(()=>root.unmount());await client.close();registry.dispose();if(!destroyed)t.renderer.destroy()}
})

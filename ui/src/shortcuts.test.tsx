import {test,expect} from 'bun:test'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {RegistryContext} from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import {Effect,Scope,Exit} from 'effect'
import {TestClock} from 'effect/testing'
import {makeClient} from './client'
import {App} from './app'
import {statusAtom} from './state'
test('composer Enter sends, Ctrl+Enter and Ctrl+J newline, memory Enter zoom',async()=>{
 const t=await createTestRenderer({width:120,height:40,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/unused-shortcuts.sock',registry);const sent:string[]=[];const inspected:unknown[]=[];
 client.send=(text)=>Effect.sync(()=>{sent.push(text);return {ok:true}});client.inspect=(request)=>Effect.sync(()=>{inspected.push(request);return ('action' in request && request.action==='models')?{value:{selected:null,models:[{model:'test-model',displayName:'Test model'}]}}:{zoom:'done'}});
 const root=createRoot(t.renderer);
 const waitReal=(predicate:()=>boolean)=>t.waitFor(predicate);
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('SLOPCHAT'));
 await t.mockInput.pasteBracketedText('/help');flushSync(()=>t.mockInput.pressEnter());await t.waitForFrame(f=>f.includes('Local UI help'));expect(sent).toEqual([]);expect(inspected).toEqual([]);expect(t.renderer.root.findDescendantById('local-help')).toBeDefined();flushSync(()=>t.mockInput.pressKey('f',{ctrl:true}));await t.flush();expect((t.renderer.root.findDescendantById('composer') as import('@opentui/core').TextareaRenderable).focused).toBe(true); const mouseBefore=t.renderer.useMouse;flushSync(()=>t.mockInput.pressKey('y',{ctrl:true}));await waitReal(()=>t.renderer.useMouse!==mouseBefore);expect(t.renderer.useMouse).toBe(!mouseBefore);flushSync(()=>t.mockInput.pressKey('y',{ctrl:true}));await waitReal(()=>t.renderer.useMouse===mouseBefore);expect(t.renderer.useMouse).toBe(mouseBefore);expect(sent).toEqual([]);
 expect(t.renderer.root.findDescendantById('composer')?.height).toBe(1);await t.mockInput.pasteBracketedText('first');flushSync(()=>t.mockInput.pressEnter({ctrl:true}));await t.flush();expect(sent).toEqual([]);expect(t.renderer.root.findDescendantById('composer')?.height).toBe(2);flushSync(()=>t.mockInput.pressBackspace());await t.waitFor(()=>t.renderer.root.findDescendantById('composer')?.height===1);expect(t.renderer.root.findDescendantById('composer')?.height).toBe(1);flushSync(()=>t.mockInput.pressEnter({ctrl:true}));await t.flush();await t.mockInput.pasteBracketedText('second');flushSync(()=>t.mockInput.pressEnter());await t.waitFor(()=>sent.length===1);expect(sent).toEqual(['first\nsecond']);await t.flush();expect(t.renderer.root.findDescendantById('local-help')).toBeUndefined();await t.waitForFrame(f=>f.includes('Enter send / Ctrl+Enter newline'));
 await t.mockInput.pasteBracketedText('third');flushSync(()=>t.mockInput.pressKey('j',{ctrl:true}));await t.mockInput.pasteBracketedText('fourth');flushSync(()=>t.mockInput.pressKey('g',{ctrl:true}));await t.waitFor(()=>sent.length===2);expect(sent[1]).toBe('third\nfourth');await t.flush();
registry.set(statusAtom,{count:1,cursor:1,working:false,summaryActive:0,summaryFailed:0,contextBytes:0,viewTotal:1,offset:0,nodes:[{id:0,n:1,text:'memory'}]});;
 flushSync(()=>t.mockInput.pressTab());await t.flush();flushSync(()=>t.mockInput.pressEnter());await t.waitFor(()=>inspected.length===1);expect(inspected).toEqual([{action:'zoom',id:0,n:1,page:0}]);expect(sent.length).toBe(2); flushSync(()=>t.mockInput.pressKey('o',{ctrl:true}));await waitReal(()=>!!t.renderer.root.findDescendantById('memory-map'));expect(t.renderer.root.findDescendantById('memory-map')).toBeDefined();flushSync(()=>t.mockInput.pressKey('o',{ctrl:true}));await waitReal(()=>!!t.renderer.root.findDescendantById('history'));expect(sent.length).toBe(2);await t.waitFor(()=>(t.renderer.root.findDescendantById('composer') as import('@opentui/core').TextareaRenderable).focused);await t.mockInput.pasteBracketedText('/ma');await waitReal(()=>t.captureCharFrame().includes('Commands: /map'));flushSync(()=>t.mockInput.pressTab());await t.flush();flushSync(()=>t.mockInput.pressEnter());await waitReal(()=>!!t.renderer.root.findDescendantById('memory-map'));expect(sent.length).toBe(2);flushSync(()=>t.mockInput.pressEscape());await waitReal(()=>!!t.renderer.root.findDescendantById('history'));expect(sent.length).toBe(2);
 await t.mockInput.pasteBracketedText('/models');flushSync(()=>t.mockInput.pressEnter());await waitReal(()=>!!t.renderer.root.findDescendantById('model-picker'));flushSync(()=>t.mockInput.pressArrow('down'));await t.flush();await t.flush();flushSync(()=>t.mockInput.pressEnter());await waitReal(()=>!t.renderer.root.findDescendantById('model-picker'));expect(inspected.at(-1)).toEqual({action:'model',model:'test-model'});expect(sent.length).toBe(2);
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

// Slash commands are local UI actions, never chat sends.

test('Ctrl+C clears, confirms, expires; Ctrl+Q does not exit',async()=>{
 const scope=Effect.runSync(Scope.make()); const clock=await Effect.runPromise(TestClock.make({warningDelay:Infinity}).pipe(Effect.provideService(Scope.Scope,scope)));
 const t=await createTestRenderer({width:120,height:40,kittyKeyboard:true,exitOnCtrlC:false});const registry=Registry.make();const client=makeClient('/tmp/unused-cancel.sock',registry);const root=createRoot(t.renderer);let destroyed=false;t.renderer.on('destroy',()=>{destroyed=true});
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client} clock={clock}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('SLOPCHAT'));
 const frame=t.captureCharFrame();expect(frame).not.toContain('Ctrl+Q');expect(frame).not.toContain('Ctrl+J');expect(frame).not.toContain('Ctrl+G');
 await t.mockInput.pasteBracketedText('  ');flushSync(()=>t.mockInput.pressKey('c',{ctrl:true}));await t.flush();expect((t.renderer.root.findDescendantById('composer') as import('@opentui/core').TextareaRenderable).plainText).toBe('');expect(destroyed).toBe(false);expect(t.captureCharFrame()).not.toContain('ctrl+c again for exit');
 flushSync(()=>t.mockInput.pressKey('q',{ctrl:true}));await t.flush();expect(destroyed).toBe(false);
 await t.flush();flushSync(()=>t.mockInput.pressKey('c',{ctrl:true}));await t.flush();await t.waitForFrame(f=>f.includes('ctrl+c again for exit'));await Effect.runPromise(clock.adjust('1 second'));flushSync(()=>{});await t.waitForFrame(f=>!f.includes('ctrl+c again for exit'));expect(t.captureCharFrame()).not.toContain('ctrl+c again for exit');expect(destroyed).toBe(false);
 await t.flush();flushSync(()=>t.mockInput.pressKey('c',{ctrl:true}));await t.flush();await t.waitForFrame(f=>f.includes('ctrl+c again for exit'));flushSync(()=>t.mockInput.pressKey('c',{ctrl:true}));await t.flush();expect(destroyed).toBe(true);
 }finally{await Effect.runPromise(Scope.close(scope,Exit.void));if(!destroyed)flushSync(()=>root.unmount());await client.close();registry.dispose();if(!destroyed)t.renderer.destroy()}
})

test('Escape reports cancellation only when Lisp confirms an active round',async()=>{
 const t=await createTestRenderer({width:120,height:40,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/unused-escape.sock',registry);const root=createRoot(t.renderer);let active=false;let calls=0;
 client.inspect=()=>Effect.sync(()=>{calls++;return {status:'data',value:active}});
 const wait=(predicate:()=>boolean)=>t.waitFor(predicate);
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('SLOPCHAT'));
 await t.mockInput.pasteBracketedText('idle draft');flushSync(()=>t.mockInput.pressEscape());await wait(()=>calls===1);await wait(()=>(t.renderer.root.findDescendantById('composer') as import('@opentui/core').TextareaRenderable).plainText==='');await t.flush();expect(t.captureCharFrame()).not.toContain('Round cancelled');
 active=true;await t.mockInput.pasteBracketedText('keep draft');flushSync(()=>t.mockInput.pressEscape());await wait(()=>t.captureCharFrame().includes('Round cancelled'));expect(calls).toBe(2);expect((t.renderer.root.findDescendantById('composer') as import('@opentui/core').TextareaRenderable).plainText).toBe('keep draft');active=false;flushSync(()=>t.mockInput.pressEscape());await wait(()=>(t.renderer.root.findDescendantById('composer') as import('@opentui/core').TextareaRenderable).plainText==='');expect(calls).toBe(3);
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

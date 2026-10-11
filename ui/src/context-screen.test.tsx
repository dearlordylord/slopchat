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
test('context opens once and Escape returns without cancelling a round',async()=>{
 const t=await createTestRenderer({width:80,height:24,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/context-fixture',registry);const session=makeViewSession();const requests:object[]=[];
 client.inspect=p=>Effect.sync(()=>{requests.push(p);return {value:{available:false}}});const root=createRoot(t.renderer);
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client} session={session}/></RegistryContext.Provider>));await t.flush();await t.mockInput.pasteBracketedText('/context');flushSync(()=>t.mockInput.pressEnter());await t.waitForFrame(f=>f.includes('Snapshot unavailable'));expect(requests).toEqual([{action:'context-calls',limit:100},{action:'context',section:'payload',offset:0}]);const editor=t.renderer.root.findDescendantById('composer') as TextareaRenderable;expect(editor.focused).toBe(false);await t.flush();flushSync(()=>t.mockInput.pressEscape());await t.waitForFrame(f=>!f.includes('Locally prepared context'));await t.waitFor(()=>editor.focused);expect(editor.focused).toBe(true);expect(requests).toHaveLength(2);
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

test('leaving context interrupts its pending read',async()=>{
 const t=await createTestRenderer({width:60,height:24,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/context-pending',registry);let interrupted=0;let started=0;
 client.inspect=()=>Effect.sync(()=>{started++}).pipe(Effect.andThen(Effect.never),Effect.ensuring(Effect.sync(()=>{interrupted++})));const root=createRoot(t.renderer);
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.flush();await t.mockInput.pasteBracketedText('/context');flushSync(()=>t.mockInput.pressEnter());await t.waitForFrame(f=>f.includes('Loading context'));await t.waitFor(()=>started===2);expect(started).toBe(2);await t.flush();await t.flush();flushSync(()=>t.mockInput.pressEscape());await t.waitFor(()=>interrupted===2);expect(interrupted).toBe(2);
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

test('context section reads pin the original call',async()=>{
 const t=await createTestRenderer({width:100,height:30,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/context-sections',registry);const requests:object[]=[];
 client.inspect=p=>Effect.sync(()=>{requests.push(p);return {value:{available:true,id:'session:1',terminal:true,outcome:'completed',observation:null,offset:0,end:4,total:4,text:'data'}}});const root=createRoot(t.renderer);
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.flush();await t.mockInput.pasteBracketedText('/context');flushSync(()=>t.mockInput.pressEnter());await t.waitForFrame(f=>f.includes('session:1'));await t.flush();flushSync(()=>t.mockInput.pressKey('2'));await t.waitFor(()=>requests.length===3);expect(requests[2]).toEqual({action:'context',section:'provenance',offset:0,id:'session:1'});await t.flush();flushSync(()=>t.mockInput.pressKey('4'));await t.waitFor(()=>requests.length===4);expect(requests[3]).toEqual({action:'context',section:'instructions',offset:0,id:'session:1'});await t.flush();flushSync(()=>t.mockInput.pressEscape());
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

test('historical context navigation selects an explicit call',async()=>{
 const t=await createTestRenderer({width:100,height:30,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/context-history',registry);const requests:object[]=[];
 client.inspect=p=>Effect.sync(()=>{requests.push(p);if('action' in p&&p.action==='context-calls')return {value:{total:2,offset:0,calls:[{id:'new',terminal:true,outcome:'completed'},{id:'old',terminal:true,outcome:'completed'}]}};return {value:{available:true,id:'id' in p?p.id:'new',terminal:true,outcome:'completed',observation:null,offset:0,end:4,total:4,text:'data'}}});const root=createRoot(t.renderer);
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.flush();await t.mockInput.pasteBracketedText('/context');flushSync(()=>t.mockInput.pressEnter());await t.waitForFrame(f=>f.includes('new /'));await t.flush();t.mockInput.pressArrow('down');await t.waitFor(()=>requests.some(p=>'id' in p&&p.id==='old'));expect(requests).toContainEqual({action:'context',section:'payload',offset:0,id:'old'});
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

test('context return preserves the composer draft cursor and selection',async()=>{
 const t=await createTestRenderer({width:100,height:30,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/context-return',registry);const session=makeViewSession();
 client.inspect=()=>Effect.succeed({value:{available:false}});const root=createRoot(t.renderer);
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client} session={session}/></RegistryContext.Provider>));await t.flush();await t.mockInput.pasteBracketedText('/context');flushSync(()=>t.mockInput.pressEnter());await t.waitForFrame(f=>f.includes('Snapshot unavailable'));const editor=t.renderer.root.findDescendantById('composer') as TextareaRenderable;editor.setText('retained draft');editor.cursorOffset=4;editor.setSelection(1,4);await t.flush();const cursor=editor.cursorOffset;const selection=editor.getSelection();await t.flush();await t.flush();flushSync(()=>t.mockInput.pressEscape());await t.waitFor(()=>editor.focused);expect(editor.focused).toBe(true);expect(editor.plainText).toBe('retained draft');expect(editor.cursorOffset).toBe(cursor);expect(editor.getSelection()).toEqual(selection);expect(session.pending.size).toBe(0);
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

test('context return restores history scroll',async()=>{
 const t=await createTestRenderer({width:100,height:30,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/context-scroll',registry);const session=makeViewSession();const root=createRoot(t.renderer);
 const {pinHostAtoms}=await import('./host-atoms');const {messagesAtom}=await import('./state');const release=pinHostAtoms(registry);
 client.inspect=()=>Effect.succeed({value:{available:false}});
 try{registry.set(messagesAtom,Array.from({length:100},(_,i)=>({i,kind:'user',text:'history '+i,size:10,date:'2026-10-09'})));flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client} session={session}/></RegistryContext.Provider>));await t.flush();const history=t.renderer.root.findDescendantById('history') as import('@opentui/core').ScrollBoxRenderable;await t.waitFor(()=>history.scrollHeight>history.height);history.scrollTop=12;expect(history.scrollTop).toBe(12);await t.mockInput.pasteBracketedText('/context');flushSync(()=>t.mockInput.pressEnter());await t.waitForFrame(f=>f.includes('Snapshot unavailable'));expect(session.scrollTop).toBe(12);await t.flush();await t.flush();flushSync(()=>t.mockInput.pressEscape());await t.waitFor(()=>!!t.renderer.root.findDescendantById('history'));const restored=t.renderer.root.findDescendantById('history') as import('@opentui/core').ScrollBoxRenderable;await t.waitFor(()=>restored.scrollTop===12);expect(restored.scrollTop).toBe(12);
 }finally{flushSync(()=>root.unmount());release();await client.close();registry.dispose();t.renderer.destroy()}
})

test('literal instructions remain readable in a narrow inspector',async()=>{
 const t=await createTestRenderer({width:60,height:24,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/context-literal',registry);const root=createRoot(t.renderer);
 client.inspect=p=>Effect.succeed({value:'action' in p&&p.action==='context-calls'?{total:1,offset:0,calls:[{id:'literal',terminal:true,outcome:'completed'}]}:{available:true,id:'literal',terminal:true,outcome:'completed',observation:null,offset:0,end:18,total:18,format:'text',text:'literal instruction'}});
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.flush();await t.mockInput.pasteBracketedText('/context');flushSync(()=>t.mockInput.pressEnter());await t.waitForFrame(f=>f.includes('literal instruction'));expect(t.captureCharFrame()).toContain('captured text');expect(t.captureCharFrame()).not.toContain('Reported input: 0');flushSync(()=>t.mockInput.pressEscape());await t.waitFor(()=>!!t.renderer.root.findDescendantById('composer')?.focused)}finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

test('global clipboard mode and Ctrl+C exit remain available in context',async()=>{
 const t=await createTestRenderer({width:100,height:30,kittyKeyboard:true,exitOnCtrlC:false});const registry=Registry.make();const client=makeClient('/tmp/context-globals',registry);const root=createRoot(t.renderer);let destroyed=false;
 t.renderer.on('destroy',()=>{destroyed=true});client.inspect=p=>Effect.succeed({value:'action' in p&&p.action==='context-calls'?{total:0,offset:0,calls:[]}:{available:false}});
 try{
  flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.flush();await t.mockInput.pasteBracketedText('/context');flushSync(()=>t.mockInput.pressEnter());await t.waitForFrame(f=>f.includes('Snapshot unavailable'));
  const mouse=t.renderer.useMouse;flushSync(()=>t.mockInput.pressKey('y',{ctrl:true}));await t.waitFor(()=>t.renderer.useMouse!==mouse);expect(t.renderer.useMouse).toBe(!mouse);
  flushSync(()=>t.mockInput.pressKey('c',{ctrl:true}));await t.waitForFrame(f=>f.includes('ctrl+c again for exit'));expect(destroyed).toBe(false);
  flushSync(()=>t.mockInput.pressKey('c',{ctrl:true}));await t.waitFor(()=>destroyed);expect(destroyed).toBe(true);
 }finally{if(!destroyed)flushSync(()=>root.unmount());await client.close();registry.dispose();if(!destroyed)t.renderer.destroy()}
})

test('call navigation crosses page boundaries in both directions',async()=>{
 const {ContextScreen}=await import('./context-screen');const t=await createTestRenderer({width:100,height:30,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/context-list-pages',registry);const root=createRoot(t.renderer);const requests:object[]=[];
 client.inspect=p=>Effect.sync(()=>{
  requests.push(p);
  if('action' in p&&p.action==='context-calls'){
   const offset='offset' in p?Number(p.offset):0;
   return {value:{total:101,offset,calls:Array.from({length:Math.min(100,101-offset)},(_,i)=>({id:'call-'+(offset+i),terminal:true,outcome:'completed'}))}};
  }
  return {value:{available:true,id:'id' in p?p.id:'call-99',terminal:true,outcome:'completed',observation:null,offset:0,end:4,total:4,text:'data'}};
 });
 try{
  flushSync(()=>root.render(<RegistryContext.Provider value={registry}><ContextScreen client={client} initialId='call-99' onExit={()=>{}}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('call-99 /'));await t.waitFor(()=>requests.some(p=>'action' in p&&p.action==='context-calls'));await t.flush();
  flushSync(()=>t.mockInput.pressArrow('down'));await t.waitForFrame(f=>f.includes('call-100 /'));expect(requests).toContainEqual({action:'context-calls',limit:100,offset:100});
  flushSync(()=>t.mockInput.pressArrow('up'));await t.waitForFrame(f=>f.includes('call-99 /'));expect(requests).toContainEqual({action:'context-calls',limit:100,offset:0});
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

test('reply context link opens the exact historical invocation',async()=>{
 const {messagesAtom}=await import('./state');const {pinHostAtoms}=await import('./host-atoms');
 const t=await createTestRenderer({width:100,height:30,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/context-reply-link',registry);const release=pinHostAtoms(registry);const root=createRoot(t.renderer);const requests:object[]=[];
 client.inspect=p=>Effect.sync(()=>{requests.push(p);if('action' in p&&p.action==='context-calls')return {value:{total:1,offset:0,calls:[{id:'exact:42',terminal:true,outcome:'completed'}]}};return {value:{available:true,id:'id' in p?p.id:'wrong-latest',terminal:true,outcome:'completed',observation:null,offset:0,end:4,total:4,text:'data'}}});
 try{
  registry.set(messagesAtom,[{i:7,kind:'slopchat',text:'Historical reply',size:16,date:'now',contextId:'exact:42'}]);flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('Historical reply'));
  const link=t.renderer.root.findDescendantById('context-link-7');if(!link)throw Error('Missing context link');await t.mockMouse.pressDown(link.x,link.y);await t.mockMouse.release(link.x,link.y);await t.waitForFrame(f=>f.includes('exact:42 /'));expect(requests).toContainEqual({action:'context',section:'payload',offset:0,id:'exact:42'});
 }finally{flushSync(()=>root.unmount());release();await client.close();registry.dispose();t.renderer.destroy()}
})

test('compaction inspection shows cache counters and reporting coverage',async()=>{
 const {ContextScreen}=await import('./context-screen');const t=await createTestRenderer({width:120,height:40,kittyKeyboard:true});const registry=Registry.make();const client=makeClient('/tmp/context-cache',registry);const root=createRoot(t.renderer);
 client.inspect=p=>Effect.succeed({value:'action' in p&&p.action==='context-calls'?{total:1,offset:0,calls:[{id:'summary',terminal:true,outcome:'completed'}]}:{available:true,id:'summary',kind:'compaction',attempt:2,terminal:true,outcome:'completed',observation:{source:'fixture',receivedAt:123,metrics:{last:{input:10,'cached-input':8,output:2},total:{input:30,'cached-input':24,output:6}}},memoryUsage:{started:2,input:30,inputObserved:2,output:6,outputObserved:2,cachedInput:24,cachedInputObserved:2,cacheWriteInput:0,cacheWriteInputObserved:0,since:123,legacy:{started:3,input:99,output:7,inputObserved:3,outputObserved:3}},offset:0,end:0,total:0,text:''}});
 try{
  flushSync(()=>root.render(<RegistryContext.Provider value={registry}><ContextScreen client={client} onExit={()=>{}}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('compaction attempt 2'));
  const frame=t.captureCharFrame();expect(frame).toContain('cache read: 8');expect(frame).toContain('Reported thread totals: input 30');expect(frame).toContain('cache read 24 (2/2 attempts)');expect(frame).toContain('cache write unavailable (0/2 attempts)');expect(frame).toContain('Legacy memory work before activation: input 99');expect(frame).toContain('Accounting period began:');
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();t.renderer.destroy()}
})

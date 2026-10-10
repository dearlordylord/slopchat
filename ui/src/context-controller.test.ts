import {signal} from './context-test-signal'
import {test,expect} from 'bun:test'
import {Effect} from 'effect'
import * as Registry from 'effect/reactivity/AtomRegistry'
import {makeClient} from './client'
import {makeContextController} from './context-controller'

test('replacing a context read interrupts the previous selection',async()=>{
 const registry=Registry.make();const client=makeClient('/tmp/context-replacement',registry);
 const started:string[]=[];const stopped:string[]=[];const began={payload:signal(),provenance:signal()};const ended={payload:signal(),provenance:signal()};
 client.inspect=p=>Effect.sync(()=>{const section='section' in p?String(p.section):'';started.push(section);if(section==='payload'||section==='provenance')began[section].complete();return section}).pipe(Effect.flatMap(section=>Effect.never.pipe(Effect.ensuring(Effect.sync(()=>{stopped.push(section);if(section==='payload'||section==='provenance')ended[section].complete()})))));
 const controller=makeContextController(client);const release=registry.mount(controller.page);
 try{await began.payload.promise;registry.set(controller.selection,{id:'original',section:'provenance',offset:0});await began.provenance.promise;await ended.payload.promise;await controller.cancel();await ended.provenance.promise;expect(started).toEqual(['payload','provenance']);}
 finally{release();await client.close();registry.dispose()}
})

test('explicit cancellation acknowledges pending read finalization',async()=>{
 const registry=Registry.make();const client=makeClient('/tmp/context-dispose',registry);
 const ready=signal();let stopped=false;
 client.inspect=()=>Effect.sync(()=>{ready.complete()}).pipe(Effect.andThen(Effect.never),Effect.ensuring(Effect.sync(()=>{stopped=true})));
 const controller=makeContextController(client);const release=registry.mount(controller.page);
 try{await ready.promise;release();await controller.cancel();expect(stopped).toBe(true)}finally{await client.close();registry.dispose()}
})

test('late completion cannot replace the selected context',async()=>{
 const registry=Registry.make();const client=makeClient('/tmp/context-stale',registry);
 let finishOld:(value:unknown)=>void=()=>{};
 const ready=signal();
 client.inspect=p=>'section' in p&&p.section==='payload'?Effect.promise(()=>new Promise(resolve=>{finishOld=resolve;ready.complete()})):Effect.succeed({value:{available:true,id:'selected',terminal:true,outcome:'completed',observation:null,offset:0,end:3,total:3,text:'new'}});
 const controller=makeContextController(client);const release=registry.mount(controller.page);
 const wait=(predicate:()=>boolean)=>new Promise<void>(resolve=>{if(predicate()){resolve();return} const unsubscribe=registry.subscribe(controller.page,()=>{if(predicate()){unsubscribe();resolve()}})});
 try{await ready.promise;registry.set(controller.selection,{id:'selected',section:'provenance',offset:0});await wait(()=>registry.get(controller.page)._tag==='Success');finishOld({value:{available:true,id:'old',terminal:true,outcome:'completed',observation:null,offset:0,end:3,total:3,text:'old'}});await controller.cancel();const result=registry.get(controller.page);expect(result._tag).toBe('Success');if(result._tag==='Success'){expect(result.value.available).toBe(true);if(result.value.available)expect(result.value.id).toBe('selected')}}finally{release();await client.close();registry.dispose()}
})

test('refresh retains the resolved snapshot identity',async()=>{
 const registry=Registry.make();const client=makeClient('/tmp/context-refresh',registry);const requests:object[]=[];
 client.inspect=p=>Effect.sync(()=>{requests.push(p);return {value:{available:true,id:'original',terminal:true,outcome:'completed',observation:null,offset:0,end:4,total:4,text:'data'}}});
 const controller=makeContextController(client);const release=registry.mount(controller.page);
 const wait=(predicate:()=>boolean)=>new Promise<void>(resolve=>{if(predicate()){resolve();return} const unsubscribe=registry.subscribe(controller.page,()=>{if(predicate()){unsubscribe();resolve()}})});
 try{await wait(()=>registry.get(controller.page)._tag==='Success');registry.refresh(controller.page);await wait(()=>requests.length===2);expect(requests[1]).toEqual({action:'context',section:'payload',offset:0,id:'original'})}finally{release();await client.close();registry.dispose()}
})

test('unsubscription alone finalizes the pending read',async()=>{
 const registry=Registry.make();const ready=signal();const ended=signal();let finalized=0;
 const controller=makeContextController({inspect:()=>Effect.sync(()=>ready.complete()).pipe(Effect.andThen(Effect.never),Effect.ensuring(Effect.sync(()=>{finalized++;ended.complete()})))});
 const release=registry.mount(controller.page);
 try{await ready.promise;release();await ended.promise;expect(finalized).toBe(1)}finally{registry.dispose()}
})


test('payload tail is snapshot pinned and earlier pages remain accessible',async()=>{
 const registry=Registry.make();const requests:object[]=[];
 const controller=makeContextController({inspect:p=>Effect.sync(()=>{
  requests.push(p);const offset='offset' in p?Number(p.offset):0;
  return {value:{available:true,id:'saved',terminal:true,outcome:'completed',observation:null,offset,end:Math.min(offset+2000,5000),total:5000,format:'text',text:offset===3000?'tail':'earlier'}}
 })});
 const wait=()=>new Promise<void>(resolve=>{
  if(registry.get(controller.page)._tag==='Success'){resolve();return}
  const off=registry.subscribe(controller.page,r=>{if(r._tag==='Success'&&!r.waiting){off();resolve()}})
 });
 registry.set(controller.selection,{section:'payload',offset:0,tail:true});const release=registry.mount(controller.page);
 try{
  await wait();const result=registry.get(controller.page);expect(result._tag).toBe('Success');
  if(result._tag==='Success'&&result.value.available){expect(result.value.text).toBe('tail');expect(result.value.offset).toBe(3000)}
  expect(requests[1]).toEqual({action:'context',id:'saved',section:'payload',offset:3000});
  registry.set(controller.selection,{id:'saved',section:'payload',offset:1000,tail:false});await wait();
  const earlier=registry.get(controller.page);if(earlier._tag==='Success'&&earlier.value.available)expect(earlier.value.offset).toBe(1000);
  expect(requests).toHaveLength(3);
 }finally{release();registry.dispose()}
})

 test('input opens at the beginning without a tail read',async()=>{
 const registry=Registry.make();const requests:object[]=[];
 const controller=makeContextController({inspect:p=>Effect.sync(()=>{requests.push(p);return {value:{available:true,id:'saved',terminal:true,outcome:'completed',observation:null,offset:0,end:2000,total:5000,text:'beginning'}}})});
 registry.set(controller.selection,{section:'input',offset:0});const release=registry.mount(controller.page);
 try{await new Promise<void>(resolve=>{if(registry.get(controller.page)._tag==='Success'){resolve();return}const off=registry.subscribe(controller.page,r=>{if(r._tag==='Success'&&!r.waiting){off();resolve()}})});expect(requests).toEqual([{action:'context',section:'input',offset:0}]);}finally{release();registry.dispose()}
 })

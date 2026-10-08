import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {RegistryContext} from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import {makeClient} from './client'
import {App} from './app'
import {messagesAtom,samplesAtom,connectionAtom} from './state'
const results=[]
for(const [width,height] of [[60,24],[120,40]]){
 const test=await createTestRenderer({width,height});const registry=Registry.make();const client=makeClient('/tmp/absent-ui-test.sock',registry);const root=createRoot(test.renderer);
 try{flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await test.waitForFrame(f=>f.includes('SLOPCHAT'));
 await test.mockInput.pasteBracketedText('\u041f\u0440\u0438\u0432\u0435\u0442');await test.flush();assert.match(test.captureCharFrame(),/\u041f\u0440\u0438\u0432\u0435\u0442/);
 test.mockInput.pressKey('g',{ctrl:true});await test.waitForFrame(f=>f.includes('Failed'));assert.match(test.captureCharFrame(),/\u041f\u0440\u0438\u0432\u0435\u0442/);
 test.mockInput.pressTab();test.mockInput.pressArrow('down');test.mockInput.pressEnter();await test.flush();
 const durations=[];for(let i=0;i<25;i++){const start=performance.now();registry.set(messagesAtom,Array.from({length:200},(_,j)=>({i:j,kind:'user',text:'message '+j+' '+('long text '.repeat(100)),size:1000,date:'now'})));registry.set(samplesAtom,Array.from({length:52},(_,j)=>(j+i)*100));registry.set(connectionAtom,'tick '+i);await test.waitForFrame(f=>f.includes('tick '+i));if(i>=5)durations.push(performance.now()-start)}
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/colored-snapshot-'+width+'.json',JSON.stringify(test.captureSpans(),null,2));await writeFile('artifacts/snapshot-'+width+'.txt',test.captureCharFrame());durations.sort((a,b)=>a-b);results.push({width,height,p50:durations[9],p95:durations[18],max:durations[19],rss:process.memoryUsage().rss});
 }finally{flushSync(()=>root.unmount());await client.close();registry.dispose();test.renderer.destroy()}
}
await writeFile('artifacts/performance.json',JSON.stringify({limits:'20 headless updates; not emulator FPS or long-run memory stability',results},null,2));console.log(JSON.stringify(results))

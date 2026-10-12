import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [piRoot, durableRoot, casesFile] = process.argv.slice(2);
const pi = await import(pathToFileURL(join(piRoot, 'src/memory.ts')).href);
const durable = await import(pathToFileURL(join(durableRoot, 'src/memory/tree.ts')).href);
const cases = JSON.parse(readFileSync(casesFile, 'utf8'));
const mergeResults = cases.map((c: any) => {
 const parts = c.parts.map(([l,i]: number[])=>({l,i}));
 const available = new Set(c.available.map((p: number[])=>p.join('/')));
 const selected = pi.mostDue(parts,c.total,(p: any)=>available.has(`${p.l}/${p.i}`));
 const addresses=parts.map((p: any)=>({start:p.i*2**p.l,count:2**p.l}));
 const nodes=new Map();
 for(const [l,i] of [...c.parts,...c.available]) {const n={start:i*2**l,count:2**l,text:'x'.repeat(40),method:'model',oversized:false};nodes.set(durable.key(n),n);}
 const before=durable.bytes(durable.render(addresses.map((p: any)=>nodes.get(durable.key(p)))));
 const after=durable.fit(addresses,nodes,before-1);
 let durableSelected=-1;
 if(after.length<addresses.length)durableSelected=addresses.findIndex((p: any,i: number)=>!after[i] || after[i].count!==p.count || after[i].start!==p.start);
 return {pi:selected,durable:durableSelected};
});
async function temp(run: (dir: string)=>Promise<any>) {const dir=mkdtempSync(join(tmpdir(),'unii-compare-'));try{return await run(dir);}finally{rmSync(dir,{recursive:true,force:true});}}
const behavior:any={};
behavior.failedContext=await temp(async dir=>{const m=new pi.Memory(dir,async()=>{throw new Error('synthetic failure')},()=>{},128000,8,60000);try {m.append('user','x'.repeat(800));await m.settle();return {ready:m.ready,render:m.render(),lastError:m.lastError};}finally{await m.close();}});
behavior.oversized=await temp(async dir=>{let calls=0;const m=new pi.Memory(dir,async()=>{calls++;return 's'.repeat(700)},()=>{});try{m.append('user','x'.repeat(800));await m.settle(undefined,'tree');return {calls,storedBytes:m.node({l:0,i:0}).size};}finally{await m.close();}});
behavior.longRecord=await temp(async dir=>{const m=new pi.Memory(dir,async()=> 'summary',()=>{});try{m.append('user','🙂'.repeat(10000));await m.settle(undefined,'tree');return {records:m.root.length,originalBytes:Buffer.byteLength(m.root[0].text)};}finally{await m.close();}});
behavior.views=await temp(async dir=>{let calls=0;const compress=async()=>{calls++;return 's'.repeat(400)};let m=new pi.Memory(dir,compress,()=>{},8000);try{for(let i=0;i<96;i++){m.append('user',`record-${i}:`+'x'.repeat(800));await m.settle(undefined,'tree');}const before={main:m.view.map((p:any)=>({...p})),compaction:m.compaction.parts.map((p:any)=>({...p})),mainText:m.render(),measured:m.chat.size,wireBytes:Buffer.byteLength(m.render()),calls};await m.close();m=new pi.Memory(dir,compress,()=>{},8000);await m.settle(undefined,'tree');const after={main:m.view,compaction:m.compaction.parts,mainText:m.render(),calls};return {before,after,mainIdentical:before.mainText===after.mainText,compactionIdentical:JSON.stringify(before.compaction)===JSON.stringify(after.compaction)};}finally{await m.close();}});
behavior.reopenSmall=await temp(async dir=>{const compress=async()=> 's'.repeat(400);let m=new pi.Memory(dir,compress,()=>{},8000);try{for(let i=0;i<3;i++){m.append('user','x'.repeat(800));await m.settle(undefined,'tree');}const before=m.compaction.parts.map((p:any)=>({...p}));const main=m.render();await m.close();m=new pi.Memory(dir,compress,()=>{},8000);await m.settle(undefined,'tree');const after=m.compaction.parts;return {before,after,compactionIdentical:JSON.stringify(before)===JSON.stringify(after),mainIdentical:main===m.render()};}finally{await m.close();}});
behavior.asyncReceipt=await temp(async dir=>{let persisted=0,release:any;const store={load:()=>({entries:[],tree:[]}),append:()=>new Promise<void>(resolve=>{release=()=>{persisted++;resolve()}}),appendNode:()=>undefined,saveView:()=>undefined,putImage:()=>undefined,image:()=>undefined};const m=new pi.Memory({directory:dir,store,saved:store.load()},async()=> 'summary',()=>{});try{const receipt=m.append('user','short');const returned={receiptId:receipt.i,persisted,visibleRecords:m.root.length};release();await m.settle(undefined,'tree');return returned;}finally{await m.close();}});
behavior.mutableRead=await temp(async dir=>{const m=new pi.Memory(dir,async()=> 'summary',()=>{});try{m.append('user','original');await m.settle(undefined,'tree');m.root[0].text='mutated';return {zoomReflectsMutation:m.zoom(0,1).includes('mutated')};}finally{await m.close();}});
console.log(JSON.stringify({mergeResults,behavior}));

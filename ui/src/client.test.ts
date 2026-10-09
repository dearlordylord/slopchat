import { test, expect } from 'bun:test'
import { Effect } from 'effect'
import * as Registry from 'effect/reactivity/AtomRegistry'
import { makeClient } from './client'
test('close interrupts all pending operations', async()=>{const registry=Registry.make(); const client=makeClient('/tmp/not-used.sock',registry); const a=client.run(Effect.never).catch(()=> 'interrupted'); const b=client.run(Effect.never).catch(()=> 'interrupted'); await client.close(); expect(await a).toBe('interrupted'); expect(await b).toBe('interrupted'); await expect(client.run(Effect.never)).rejects.toThrow('UI closed'); registry.dispose()})

import { createServer } from 'node:net'
import { messagesAtom } from './state'
test('older history merges in order and stops at zero', async()=>{
 const socket='/tmp/slopchat-paging-'+process.pid+'.sock'; let reads=0;
 const server=createServer(c=>c.once('data',raw=>{const p=JSON.parse(raw.toString()); reads++; expect(p.before).toBe(40); c.end(JSON.stringify({status:'data',value:{count:80,start:0,end:40,messages:[{i:0,kind:'user',text:'older',size:5,date:'now'}]}})+'\n')}));
 await new Promise<void>(r=>server.listen(socket,r)); const registry=Registry.make(); const client=makeClient(socket,registry);
 const unmount=registry.mount(messagesAtom); try {registry.set(messagesAtom,[{i:40,kind:'user',text:'later',size:5,date:'now'}]); await client.run(client.older()); expect(registry.get(messagesAtom).map(m=>m.i)).toEqual([0,40]); await client.run(client.older()); expect(reads).toBe(1)} finally {await client.close(); unmount(); registry.dispose(); await new Promise<void>(r=>server.close(()=>r()))}
})

import { request } from './transport'
test('fragmented JSONL and unknown send disconnect', async()=>{
 const socket='/tmp/slopchat-transport-'+process.pid+'.sock';
 const server=createServer(c=>c.once('data',raw=>{const p=JSON.parse(raw.toString()); if(p.action==='send'){c.end();return} const line=JSON.stringify({status:'data',value:'unicode Hello \u{1F30D}'})+'\n'; c.write(line.slice(0,13)); setImmediate(()=>c.end(line.slice(13)))}));
 await new Promise<void>(r=>server.listen(socket,r));
 try {const response=await Effect.runPromise(request(socket,{action:'history'})); expect(JSON.stringify(response)).toContain('unicode'); const error=await Effect.runPromise(request(socket,{action:'send',text:'test'},true)).catch(e=>e); expect(String(error)).toContain('Connection closed'); } finally {await new Promise<void>(r=>server.close(()=>r()))}
})


import {test,expect} from 'bun:test'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {decodeManifest,publishPointer,readCandidate} from './revisions'
test('manifest confines immutable entries and rejects incompatible API',()=>{for(const file of ['../bad.mjs','view-x.ts','/tmp/view-x.mjs'])expect(()=>decodeManifest(JSON.stringify({api:1,file}))).toThrow();expect(()=>decodeManifest('{"api":2,"file":"view-ok.mjs"}')).toThrow()})
test('publication is pointer-last and failed import leaves pointer readable',async()=>{const d=await mkdtemp(join(tmpdir(),'slopchat-revision-'));try{await writeFile(join(d,'view-good.mjs'),'export const hostApiVersion=1;export function View(){}');await publishPointer(d,'view-good.mjs');expect((await readCandidate(d)).file).toBe('view-good.mjs');const before=await readFile(join(d,'current.json'),'utf8');await expect(publishPointer(d,'view-missing.mjs')).rejects.toThrow();expect(await readFile(join(d,'current.json'),'utf8')).toBe(before);await writeFile(join(d,'view-bad.mjs'),'throw new Error("import rejected")');await publishPointer(d,'view-bad.mjs');await expect(readCandidate(d)).rejects.toThrow('import rejected')}finally{await rm(d,{recursive:true,force:true})}})

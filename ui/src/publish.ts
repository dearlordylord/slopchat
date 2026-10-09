import {resolve} from 'node:path'
import {mkdir,rename,rm} from 'node:fs/promises'
import {publishPointer} from './revisions'
const root=resolve(import.meta.dir,'..');const directory=resolve(process.env.SLOPCHAT_UI_REVISIONS??resolve(root,'.revisions'));await mkdir(directory,{recursive:true});
for(const command of [['bun','run','typecheck'],['bun','test'],['bun','src/smoke.tsx']]){const p=Bun.spawn(command,{cwd:root,stdout:'inherit',stderr:'inherit'});if(await p.exited!==0)throw new Error('Candidate validation failed: '+command.join(' '))}
const file='view-'+Date.now()+'-'+crypto.randomUUID()+'.mjs';const temporary=resolve(directory,file+'.tmp');
const result=await Bun.build({entrypoints:[resolve(root,'src/view.tsx')],target:'bun',packages:'external',plugins:[{name:'host-identities',setup(build){build.onResolve({filter:/^(\.\/host-atoms|\.\/chart)$/},args=>({path:resolve(root,'src',args.path.slice(2)+'.ts'),external:true}))}}],});
if(!result.success){console.error(result.logs);await rm(temporary,{force:true});throw new Error('Candidate build failed')}
let source=await result.outputs[0].text();for(const name of ['host-atoms','chart'])source=source.replaceAll(JSON.stringify('./'+name),JSON.stringify(resolve(root,'src',name+'.ts')));if(source.includes('Atom.make')||source.includes('extend({'))throw new Error('Host graph leaked into bundle');await Bun.write(temporary,source);await rename(temporary,resolve(directory,file));const candidate=await import(resolve(directory,file));if(candidate.hostApiVersion!==1||typeof candidate.View!=='function')throw new Error('Candidate API rejected');
await publishPointer(directory,file);console.log('Published '+file+'; activation must be acknowledged by running host.');

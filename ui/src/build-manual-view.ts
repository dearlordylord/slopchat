import {resolve} from 'node:path'
import {mkdir,rename} from 'node:fs/promises'
const root=resolve(import.meta.dir,'..');
const directory=resolve(root,'.manual-views');await mkdir(directory,{recursive:true});
const file=resolve(directory,crypto.randomUUID()+'.mjs');
const result=await Bun.build({entrypoints:[resolve(root,'src/manual-view.tsx')],target:'bun',packages:'external',plugins:[{name:'host-identities',setup(build){build.onResolve({filter:/host-atoms|chart/},args=>({path:resolve(root,'src',args.path.slice(2)+'.ts'),external:true}))}}]});
if(!result.success)throw new Error(result.logs.join('\n'));
let source=await result.outputs[0].text();for(const name of ["host-atoms","chart"])source=source.replaceAll(JSON.stringify("./"+name),JSON.stringify(resolve(root,"src",name+".ts")));if(source.includes('// src/state.ts')||source.includes('extend({'))throw new Error('Host identities leaked into bundle');
await Bun.write(file+'.tmp',source);await rename(file+'.tmp',file);console.log(file);

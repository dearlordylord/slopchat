"""Disposable headless probe; leaves production UI and live chat untouched."""
import json, os, pathlib, shutil, signal, subprocess, tempfile, time
root=pathlib.Path(__file__).resolve().parents[2]
ui=root/'ui'
folder=pathlib.Path(tempfile.mkdtemp(prefix='.research-revision-',dir=ui))
view="""import {useEffect,useState} from 'react'
import {useAtomValue} from '@effect/atom-react'
export const hostApiVersion=1
export const label='VERSION'
export function View({host}:any){const draft=useAtomValue(host.draft);const [local,setLocal]=useState('initial local');useEffect(()=>{host.mounts++;host.local=setLocal},[]);return <text>{label+' | '+draft+' | '+local}</text>}
"""
host="""import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {RegistryContext} from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import * as Atom from 'effect/reactivity/Atom'
import {useEffect,useState} from 'react'
import {readFileSync} from 'node:fs'
const test=await createTestRenderer({width:70,height:8});const h:any={test,registry:Registry.make(),draft:Atom.make('typed draft'),mounts:0,roots:1,renderers:1,revision:'v1',errors:0}
const initial=await import('./view-v1.mjs');let selected='v1';let busy=false
function Boundary(){const [Current,setCurrent]=useState(()=>initial.View);useEffect(()=>{h.swap=(next:any)=>setCurrent(()=>next)},[]);return <RegistryContext.Provider value={h.registry}><Current host={h}/></RegistryContext.Provider>}
const root=createRoot(test.renderer);flushSync(()=>root.render(<Boundary/>));await test.waitForFrame(f=>f.includes('v1'));h.local('changed local')
setInterval(async()=>{if(busy)return;busy=true;try{const wanted=readFileSync(new URL('./pointer',import.meta.url),'utf8').trim();if(wanted!==selected){selected=wanted;try{const candidate=await import('./view-'+wanted+'.mjs');if(candidate.hostApiVersion!==1)throw new Error('host API mismatch');flushSync(()=>h.swap(candidate.View));h.revision=wanted}catch(error){h.errors++;console.log('REJECT '+String(error))}}await test.flush();console.log('PROBE '+JSON.stringify({pid:process.pid,mounts:h.mounts,roots:h.roots,renderers:h.renderers,revision:h.revision,errors:h.errors,frame:test.captureCharFrame().trim()}))}finally{busy=false}},100)
"""
(folder/'host.tsx').write_text(host)
(folder/'pointer').write_text('v1')
def build(version,source):
 path=folder/('source-'+version+'.tsx');path.write_text(source)
 return subprocess.run(['bun','build',str(path),'--target=bun','--packages=external','--outfile='+str(folder/('view-'+version+'.mjs'))],cwd=ui,capture_output=True,text=True)
def publish(version):
 temporary=folder/'pointer.next';temporary.write_text(version);temporary.replace(folder/'pointer')
assert build('v1',view.replace('VERSION','v1')).returncode==0
log=folder/'run.log'
try:
 with log.open('w') as out:
  process=subprocess.Popen(['bun',str(folder/'host.tsx')],cwd=ui,stdout=out,stderr=out,start_new_session=True)
  def wait(predicate,timeout=8):
   deadline=time.monotonic()+timeout
   while time.monotonic()<deadline:
    data=log.read_text(errors='replace')
    if predicate(data):return data
    if process.poll() is not None:raise RuntimeError(data[-2000:])
    time.sleep(.05)
   raise TimeoutError(log.read_text(errors='replace')[-2000:])
  try:
   wait(lambda x:'v1 | typed draft | changed local' in x)
   assert build('v2',view.replace('VERSION','v2')).returncode==0;publish('v2')
   wait(lambda x:'v2 | typed draft | initial local' in x)
   broken=build('syntax','export const broken = ;')
   assert broken.returncode!=0
   (folder/'view-reject.mjs').write_text("throw new Error('candidate import failure')")
   publish('reject');wait(lambda x:'candidate import failure' in x and '"errors":1' in x)
   assert build('v3',view.replace('VERSION','v3')).returncode==0;publish('v3')
   data=wait(lambda x:'v3 | typed draft | initial local' in x)
   samples={}
   for line in data.splitlines():
    if line.startswith('PROBE '):
     record=json.loads(line[6:]);samples[(record['revision'],record['errors'])]=record
   result={'versions':{'bun':'1.3.14','opentui':'0.5.17','react':'19.3.0','effect':'4.0.2'},'samples':list(samples.values()),'syntaxBuildRejected':broken.returncode!=0,'limits':'Headless demonstration only: external Atom value, one renderer/root, immutable bundles; no actual textarea/cursor, terminal, socket, pending send, render-failure rollback or long-run leak test.'}
   target=root/'docs/experiments/tui-live-update-result.json';target.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
  finally:
   os.killpg(process.pid,signal.SIGTERM)
   try:process.wait(timeout=3)
   except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait()
finally:
 shutil.rmtree(folder)

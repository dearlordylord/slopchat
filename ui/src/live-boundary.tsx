import {Component,useEffect,useRef,useState,type ReactNode} from 'react'
import {useKeyboard} from '@opentui/react'
import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {readCandidate} from './revisions'
type Candidate=Awaited<ReturnType<typeof readCandidate>>
class Guard extends Component<{children:ReactNode;failed:(e:Error)=>void},{broken:boolean}>{state={broken:false};static getDerivedStateFromError(){return {broken:true}};componentDidCatch(e:Error){this.props.failed(e)};render(){return this.state.broken?null:this.props.children}}
function Commit({done}:{done:()=>void}){useEffect(done,[]);return null}
export function LiveBoundary({directory,host,onCheck}:{directory:string;onCheck?:(check:()=>Promise<void>)=>void;host:{App:()=>import('react').ReactNode;client:ReturnType<typeof import('./client').makeClient>;session:import('./view-session').ViewSession;atoms:typeof import('./state')}}){
 const snapshot=()=>{const s=host.session;const e=s.editor;if(e&&!e.isDestroyed){s.draft=e.plainText;s.cursor=e.cursorOffset;s.selection=e.getSelection()}const h=s.history;if(h&&!h.isDestroyed){s.scrollTop=h.scrollTop;s.scrollLeft=h.scrollLeft}};
 const [candidate,setCandidate]=useState<Candidate>();const committed=useRef<Candidate|undefined>(undefined);const [status,setStatus]=useState('Waiting for publication');const [retry,setRetry]=useState(0);const [generation,setGeneration]=useState(0);
 useEffect(()=>{let stopped=false,busy=false,last='';const check=async()=>{if(stopped)return;if(busy){last='';return}busy=true;try{const raw=await readFile(resolve(directory,'current.json'),'utf8');if(raw===last)return;last=raw;const next=await readCandidate(directory);if(!stopped){snapshot();setCandidate(next);setGeneration(v=>v+1);setStatus('Activating '+next.label)}}catch(e){if(!stopped)setStatus('Rejected: '+String(e))}finally{busy=false}};onCheck?.(check);void check();const timer=setInterval(()=>{void check()},500);return()=>{stopped=true;clearInterval(timer)}},[directory,retry]);
 const success=()=>{committed.current=candidate;setStatus(old=>old.startsWith('Render rejected')?old:'Active '+(candidate?.label??'initial'));if(candidate)void writeFile(resolve(directory,'activation.json'),JSON.stringify({pid:process.pid,file:candidate.file,status:'committed',time:new Date().toISOString()})).catch(e=>setStatus('Acknowledgement failed: '+String(e)))};
 const failed=(e:Error)=>{setStatus('Render rejected; restored previous view: '+String(e));setCandidate(committed.current);setGeneration(v=>v+1)};
 useKeyboard(k=>{if(k.ctrl&&k.name==='b'){snapshot();setCandidate(undefined);setGeneration(v=>v+1);setStatus('Restored initial view')}if(k.ctrl&&k.name==='r')setRetry(v=>v+1)});
 const Current=candidate?.View;return <box width='100%' height='100%' flexDirection='column'><text height={1}>{status} | Ctrl+R retry / Ctrl+B initial</text><Guard key={generation} failed={failed}>{Current?<Current host={host}/>:<host.App/>}<Commit done={success}/></Guard></box>
}

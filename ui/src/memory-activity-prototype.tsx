import type {Status} from './protocol'
import {theme} from './theme'
import {useTimeline} from '@opentui/react'
import {useLayoutEffect,useState} from 'react'

/** Separate provider observation and approximate fresh-round prediction. */
export function memoryTokenLabel(status:Status|undefined,draft=''){
 const metrics=(status?.contextCall?.lastReported?.observation??status?.contextCall?.observation)?.metrics
 const compact=(n:number|undefined)=>n===undefined?'unavailable':n>=1000?(n/1000).toFixed(1)+'k':String(n)
 const basis=status?.nextBasis
 const escaped=Array.from(draft).reduce((n,c)=>n+([String.fromCharCode(34),String.fromCharCode(92),String.fromCharCode(10)].includes(c)?2:1),0)
 const total=basis?Math.ceil(basis.instructions/4)+Math.ceil(basis.tools/4)+Math.ceil((basis.input+escaped)/4):undefined
 return 'Context · last '+compact(metrics?.last?.input)+' / '+compact(metrics?.['context-limit'])+' · next '+(total===undefined?'unavailable':'~'+compact(total))
}
/** Session summary-work totals; missing observations are not zero. */
export function memoryWorkLabel(status:Status|undefined){
 const u=status?.memoryUsage
 if(!u)return 'Memory unavailable'
 const compact=(n:number)=>n>=1000?(n/1000).toFixed(1)+'k':String(n)
 return 'Memory '+(u.inputObserved?compact(u.input):'unavailable')+' in / '+(u.outputObserved?compact(u.output):'unavailable')+' out'+(u.inputObserved<u.started||u.outputObserved<u.started?' · partial':'')
}
export const summaryFrames=['◐','◓','◑','◒'] as const
function SummarySpinner(){
 const [frame,setFrame]=useState(0)
 const timeline=useTimeline({duration:800,loop:true,autoplay:false})
 // Renderer-owned animation is a time boundary; no application polling timer.
 useLayoutEffect(()=>{
  timeline.add({phase:0},{phase:4,duration:800,ease:'linear',onUpdate:a=>setFrame(Math.min(3,Math.floor(a.progress*4)))})
  timeline.play()
  return()=>{timeline.pause();timeline.resetItems()}
 },[timeline])
 return <text fg={theme.agent}>{summaryFrames[frame]}</text>
}
export function MemoryActivityPrototype({status,draft=''}:{status:Status|undefined;draft?:string}){
 return <box id='memory-activity-prototype' flexDirection='row' height={1} flexShrink={0}><text fg={theme.muted}>{memoryTokenLabel(status,draft)} · {memoryWorkLabel(status)}</text>{status&&status.summaryActive>0?<><text> · </text><SummarySpinner/><text fg={theme.muted}>{' '+status.summaryActive}</text></>:null}{status&&status.summaryFailed>0?<text fg={theme.error}>{' · failed '+status.summaryFailed}</text>:null}</box>
}

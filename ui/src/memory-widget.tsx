import {useState} from 'react'
import {memoryWidgetBinding} from './ui-commands'
import type {Status} from './protocol'
import {theme} from './theme'
/** Bounded Lisp-confirmed session history, separate from current jobs. */
export function MemoryWidget({status}:{status:Status|undefined}){
 const [expanded,setExpanded]=useState<number|null>(null)
 const jobs=status?.memoryJobs
 const events=status?.memoryEvents
 return <box id='memory-widget' height={9} flexShrink={0} border borderColor={theme.border} flexDirection='column'><text height={1} flexShrink={0} fg={theme.agent}>Memory · {memoryWidgetBinding.label} hide</text><text height={1} flexShrink={0} fg={theme.muted}>Built ≠ published; published ≠ delivered. Session history only.</text><scrollbox flexGrow={1} contentOptions={{flexDirection:'column'}}><text wrapMode='word'>{jobs===undefined?'Job details unavailable':jobs.length===0?'No current jobs':jobs.slice(0,100).map(j=>j.id+'+'+j.n+' · '+j.state).join(String.fromCharCode(10))}</text><text fg={theme.muted}>Recent events · {events===undefined?'unavailable':events.length===0?'none observed':events.length+'/50'}</text>{events?.map(e=><box key={e.sequence} focusable onKeyDown={key=>{if(key.name==='return'){key.preventDefault();setExpanded(expanded===e.sequence?null:e.sequence)}}} flexDirection='column' flexShrink={0}><text onMouseDown={()=>setExpanded(expanded===e.sequence?null:e.sequence)} fg={e.kind==='job-failed'?theme.error:theme.muted} wrapMode='word'>{e.sequence+' · '+(e.id===null?'view cursor '+e.cursor:e.id+'+'+e.n)+' · '+(e.kind==='job-completed'?'summary built':e.kind==='view-published'?'view published':e.kind)+' · Enter / click details'}</text>{expanded===e.sequence?<text wrapMode='word' flexShrink={0}>{e.detail}</text>:null}</box>)}</scrollbox></box>
}

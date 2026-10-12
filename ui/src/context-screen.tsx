import type {Status} from './protocol'
import {contextSections,contextSectionHint} from './context-sections'
import {Expression} from './expression'
import {useMemo,useState,useEffect} from 'react'
import {useAtom,useAtomValue,useAtomRefresh} from '@effect/atom-react'
import {makeContextController} from './context-controller'
import {useKeyboard} from '@opentui/react'
import {Cause} from 'effect'
import type {makeClient} from './client'
import {theme} from './theme'
export function ContextScreen({client,onExit,initialId,status}:{status?:Status;initialId?:string;client:ReturnType<typeof makeClient>;onExit:()=>void}){
 const controller=useMemo(()=>makeContextController(client,undefined,initialId),[client,initialId])
 const [selection,setSelection]=useAtom(controller.selection)
 const [requestedOffset,setCallOffset]=useAtom(controller.callOffset)
 const [pendingEdge,setPendingEdge]=useState<'first'|'last'|null>(null)
 const list=useAtomValue(controller.calls)
 const result=useAtomValue(controller.page)
 const refreshPage=useAtomRefresh(controller.page)
 const refreshCalls=useAtomRefresh(controller.calls)
 const page=result._tag==='Success'&&!result.waiting?result.value:null
 const loading=result._tag==='Initial'||result.waiting
 const error=result._tag==='Failure'?Cause.pretty(result.cause).split('\n')[0]?.slice(0,500)??'Context unavailable':''
 const listError=list._tag==='Failure'?'Call list unavailable: '+(Cause.pretty(list.cause).split('\n')[0]?.slice(0,500)??'unknown error'):''
 const calls=list._tag==='Success'?list.value.calls:[]
 const callOffset=list._tag==='Success'?list.value.offset:(requestedOffset??0)
 useEffect(()=>{
  if(!pendingEdge||list._tag!=='Success'||list.waiting||list.value.offset!==requestedOffset)return
  const call=pendingEdge==='first'?list.value.calls[0]:list.value.calls.at(-1)
  if(call)setSelection({...selection,id:call.id,offset:0,tail:selection.section==='payload'})
  setPendingEdge(null)
 },[pendingEdge,list,requestedOffset,selection,setSelection])
 useKeyboard(k=>{
  if(k.name==='r'){k.preventDefault();refreshPage();refreshCalls();return}
  if(k.name==='escape'){k.preventDefault();controller.cancel();onExit();return}
  const id=selection.id??(page?.available?page.id:undefined)
  if((k.name==='up'||k.name==='down')&&calls.length){
   const current=calls.findIndex(call=>call.id===id)
   if(k.name==='down'&&current===calls.length-1&&list._tag==='Success'&&callOffset+calls.length<list.value.total){
    setPendingEdge('first');setCallOffset(callOffset+calls.length);return
   }
   if(k.name==='up'&&current===0&&callOffset>0){setPendingEdge('last');setCallOffset(Math.max(0,callOffset-100));return}
   const next=Math.max(0,Math.min(calls.length-1,current+(k.name==='up'?-1:1)))
   const call=calls[next];if(call)setSelection({...selection,id:call.id,offset:0,tail:selection.section==='payload' })
  }
  if(k.name==='right'&&page?.available&&page.end<page.total)setSelection({...selection,id,offset:page.end,tail:false})
  if(k.name==='left')setSelection({...selection,id,offset:Math.max(0,(page?.available?page.offset:selection.offset)-2000),tail:false})
  const section=contextSections.find(s=>s.key===k.name)?.section
  if(section)setSelection({id,section,offset:0,tail:section==='payload'})
 })
 const memory=page?.memoryUsage
 const observation=page?.available?page.observation:null
 const counts=observation?.metrics?.last
 const totals=observation?.metrics?.total
 const limit=observation?.metrics?.['context-limit']
 const observed=observation?new Date(observation.receivedAt*1000).toISOString():'unavailable'
 return <box id='context-screen' flexGrow={1} flexDirection='column' border borderColor={theme.agent}><text flexShrink={0} wrapMode='word' fg={theme.text}>Locally prepared context — not hidden provider context</text><text flexShrink={0} wrapMode='word' fg={theme.muted}>{'Esc chat · R refresh · Up/Down calls · '+contextSectionHint+' · Left/Right pages'}</text><text flexShrink={0} wrapMode='word' fg={theme.text}>{page?.available?page.id+' / '+(page.outcome??'active')+(page.kind?' · '+page.kind+' attempt '+(page.attempt??1):''):loading?'Loading context...':error?'Context request failed':'Snapshot unavailable'}</text><text flexShrink={0} wrapMode='word' fg={theme.text}>{'Reported input: '+(counts?.input??'unavailable')+' · cache read: '+(counts?.['cached-input']??'unavailable')+' · cache write: '+(counts?.['cache-write-input']??'unavailable')+' · output: '+(counts?.output??'unavailable')}</text><text flexShrink={0} wrapMode='word' fg={theme.text}>{'Reported thread totals: input '+(totals?.input??'unavailable')+' · cache read '+(totals?.['cached-input']??'unavailable')+' · output '+(totals?.output??'unavailable')}</text><text flexShrink={0} wrapMode='word' fg={theme.text}>{'Reported context limit: '+(limit??'unavailable')+' tokens · observation: '+observed}</text><text flexShrink={0} wrapMode='word' fg={theme.muted}>{page?.available&&page.estimate?'Estimated captured-call tokens: ~'+page.estimate.total+' · instructions ~'+page.estimate.instructions+' · tools ~'+page.estimate.tools+' · input ~'+page.estimate.input+' ('+page.estimate.method+'; memory '+(page.estimate.memory===undefined?'unavailable':'~'+page.estimate.memory)+'; other input '+(page.estimate.otherInput===undefined?'unavailable':'~'+page.estimate.otherInput)+'; subsets of input)':'Estimated tokens: unavailable'}</text><text flexShrink={0} wrapMode='word' fg={theme.muted}>Context/cache percentages unavailable: accounting not validated</text><text flexShrink={0} wrapMode='word' fg={theme.muted}>{memory?'Memory work since accounting started: input '+(memory.inputObserved?memory.input:'unavailable')+' ('+memory.inputObserved+'/'+memory.started+' attempts) · output '+(memory.outputObserved?memory.output:'unavailable')+' ('+memory.outputObserved+'/'+memory.started+' attempts) · cache read '+(memory.cachedInputObserved?memory.cachedInput:'unavailable')+' ('+(memory.cachedInputObserved??0)+'/'+memory.started+' attempts) · cache write '+(memory.cacheWriteInputObserved?memory.cacheWriteInput:'unavailable')+' ('+(memory.cacheWriteInputObserved??0)+'/'+memory.started+' attempts)'+(memory.inputObserved<memory.started||memory.outputObserved<memory.started?' · incomplete':''):'Memory work: unavailable'}</text>{memory?.since?<text flexShrink={0} wrapMode='word' fg={theme.muted}>{'Accounting period began: '+new Date(memory.since*1000).toISOString()}</text>:null}{memory?.legacy?<text flexShrink={0} wrapMode='word' fg={theme.muted}>{'Legacy memory work before activation: input '+memory.legacy.input+' · output '+memory.legacy.output+' · attempts '+memory.legacy.started+' (old last-report accounting; not corrected)'}</text>:null}<text flexShrink={0} fg={theme.muted}>{selection.section+' · '+(page?.available&&page.format==='text'?'captured text':'exact Lisp representation')+' · offset '+(page?.available?page.offset:selection.offset)}</text><scrollbox flexGrow={1}>{page?.available&&page.format==='text'?<text wrapMode='word'>{page.text}</text>:<Expression source={page?.available?page.text:''}/>}</scrollbox>{listError?<text flexShrink={0} wrapMode='word' fg={theme.error}>{listError}</text>:null}{error?<text flexShrink={0} wrapMode='word' fg={theme.error}>{error}</text>:null}</box>
}

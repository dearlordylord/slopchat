import {Expression} from './expression'
import {useState,useRef,useEffect} from 'react'
import {useRenderer,flushSync} from '@opentui/react'
import {Effect,Fiber,Schema} from 'effect'
import type {BoxRenderable} from '@opentui/core'
import type {Message} from './protocol'
import type {makeClient} from './client'
import {theme} from './theme'
const ExpressionPage=Schema.Struct({offset:Schema.Number,end:Schema.Number,total:Schema.Number,text:Schema.String})
export function ToolCard({message,result,client,onContext}:{message:Message;result?:Message;client?:ReturnType<typeof makeClient>;onContext?:(id?:string)=>void}){
 const renderer=useRenderer();const card=useRef<BoxRenderable>(null);const [expanded,setExpanded]=useState(false);const tool=message.tool;
 const [offset,setOffset]=useState(0);const [page,setPage]=useState<Schema.Schema.Type<typeof ExpressionPage>|null>(null);const [error,setError]=useState('');
 useEffect(()=>{
  if(!expanded||!tool?.expressionTruncated||!client)return;
  let active=true;setPage(null);setError('');
  const fiber=Effect.runFork(client.inspect({action:'tool-expression',id:message.i,offset}).pipe(Effect.timeout('5 seconds'),Effect.flatMap(Schema.decodeUnknownEffect(Schema.Struct({value:ExpressionPage})))));
  Effect.runPromise(Fiber.join(fiber)).then(response=>{if(active){setPage(response.value);renderer.requestRender()}}).catch(error=>{if(active){setError(String(error).split('\n')[0]?.slice(0,500)??'Read failed');renderer.requestRender()}});
  return()=>{active=false;Effect.runFork(Fiber.interrupt(fiber))};
 },[expanded,tool?.expressionTruncated,client,message.i,offset,renderer]);
 const toggle=()=>{if(!renderer.getSelection()?.getSelectedText()){flushSync(()=>setExpanded(v=>!v));renderer.requestRender()}};
 if(!tool)return null;const state=result?.tool?.state??tool.state;
 const source=page?.text??(tool.expression||message.text);
 return <box ref={card} focusable flexDirection='column' onKeyDown={key=>{
  if(key.name==='return'){key.preventDefault();toggle()}
  if(key.name==='c')renderer.copyToClipboardOSC52(source||message.text);
  if(key.name==='r')renderer.copyToClipboardOSC52(result?.text??'');
  if(key.name==='x'&&message.contextId){key.preventDefault();onContext?.(message.contextId)}
  if(expanded&&key.name==='right'&&page&&page.end<page.total){key.preventDefault();setOffset(page.end)}
  if(expanded&&key.name==='left'&&offset>0){key.preventDefault();setOffset(Math.max(0,offset-2000))}
 }}><text id={'tool-'+message.i} fg={state==='error'?theme.error:theme.tool} onMouseUp={toggle}>{(expanded?'▼ ':'▶ ')+tool.name+' - '+state+' · '+tool.callId}</text>{message.contextId?<text id={'context-link-'+message.i} fg={theme.muted} onMouseUp={()=>onContext?.(message.contextId)}>{'Context ↗ '+message.contextId+' · X inspect'}</text>:null}{expanded?<box flexDirection='column'><text>{tool.expressionTruncated?'Expression page · Left/Right · C copies visible page · '+(page?page.offset+'–'+page.end+' / '+page.total:'loading'):'Expression'}</text><Expression source={source}/>{error?<text fg={theme.error}>{'Expression unavailable: '+error}</text>:null}</box>:null}</box>
}

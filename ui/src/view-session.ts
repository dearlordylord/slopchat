import type {TextareaRenderable,ScrollBoxRenderable} from '@opentui/core'
export function makeViewSession(){const listeners=new Set<()=>void>();return {inputHistory:[] as string[],historyIndex:-1,historyDraft:'',draft:'',cursor:0,selection:null as {start:number;end:number}|null,focus:true,selected:0,result:'',scrollTop:0,scrollLeft:0,pending:new Set<string>(),editor:null as TextareaRenderable|null,history:null as ScrollBoxRenderable|null,subscribe:(f:()=>void)=>{listeners.add(f);return ()=>{listeners.delete(f)}},notify:()=>{for(const f of listeners)f()}}}
export type ViewSession=ReturnType<typeof makeViewSession>
export function report(session:ViewSession,result:string){session.result=result;session.notify()}

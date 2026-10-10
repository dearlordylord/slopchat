import {Effect,Schema,Fiber,Clock} from 'effect'
import * as Atom from 'effect/reactivity/Atom'
import {ContextPage,ContextCalls} from './protocol'
import type {ContextSection} from './context-sections'
export interface ContextReader { readonly inspect:(payload:object)=>Effect.Effect<unknown,unknown> }

/** Registry-owned reads are interrupted when their subscribers leave. */
export function makeContextController(client:ContextReader, clock?:Clock.Clock,initialId?:string){
 const pending=new Set<Fiber.Fiber<unknown,unknown>>()
 const cancel=()=>Effect.runPromise(Fiber.interruptAll(pending))
 const selection=Atom.make<{id?:string;section:ContextSection;offset:number;tail?:boolean}>({id:initialId,section:'payload',offset:0,tail:true})
 const read=<A>(payload:object,schema:Schema.Codec<A>)=>Effect.gen(function*(){
  const fiber=yield* client.inspect(payload).pipe(Effect.timeout('5 seconds'),effect=>clock?Effect.provideService(effect,Clock.Clock,clock):effect,Effect.flatMap(Schema.decodeUnknownEffect(Schema.Struct({value:schema}))),Effect.forkChild)
  pending.add(fiber)
  return yield* Fiber.join(fiber).pipe(Effect.ensuring(Fiber.interrupt(fiber).pipe(Effect.andThen(Effect.sync(()=>{pending.delete(fiber)})))),Effect.map(response=>response.value))
 })
 const callOffset=Atom.make<number|undefined>(undefined)
 const calls=Atom.make(get=>{
  const offset=get(callOffset)
  return read({action:'context-calls',limit:100,...(offset===undefined?(initialId?{id:initialId}:{}):{offset})},ContextCalls)
 }).pipe(Atom.setIdleTTL('0 millis'))
 let resolvedId:string|undefined
 const page=Atom.make(get=>{
  const selected=get(selection)
  return read({action:'context',section:selected.section,offset:selected.offset,...((selected.id??resolvedId)?{id:selected.id??resolvedId}:{})},ContextPage).pipe(Effect.flatMap(page=>{
   if(page.available)resolvedId=page.id
   if(selected.section==='payload'&&selected.tail&&page.available&&page.total>2000)
    return read({action:'context',id:page.id,section:'payload',offset:page.total-2000},ContextPage)
   return Effect.succeed(page)
  }))
 }).pipe(Atom.setIdleTTL('0 millis'))
 return {selection,callOffset,calls,page,cancel}
}

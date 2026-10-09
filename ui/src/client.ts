import { Effect, Fiber, Schema, Schedule, Stream } from 'effect'
import * as Registry from 'effect/reactivity/AtomRegistry'
import { request } from './transport'
import { History, Status } from './protocol'
import { messagesAtom, statusAtom, connectionAtom, samplesAtom } from './state'
export function makeClient(socket: string, registry: Registry.AtomRegistry) {
 const pending = new Set<Fiber.Fiber<unknown, unknown>>()
 let closed = false
 const run = <A,E>(effect: Effect.Effect<A, E>) => {
  if (closed) return Promise.reject(new Error('UI closed'))
  const fiber = Effect.runFork(effect); pending.add(fiber)
  return Effect.runPromise(Fiber.join(fiber)).finally(() => pending.delete(fiber))
 }
 const close = () => { closed = true; return Effect.runPromise(Fiber.interruptAll(pending)) }
 let cursor: number | undefined
 const poll = Effect.fn('Chat.resync')(function* () {
  const response = yield* request(socket, cursor === undefined ? {action:'history',limit:40} : {action:'history',after:cursor,limit:40}).pipe(Effect.timeout('5 seconds'))
  const envelope = Schema.decodeUnknownSync(Schema.Struct({value:History}))(response)
  const page = envelope.value
  if (page.messages.length > 0)   registry.update(messagesAtom, old => [...old.filter(m => !page.messages.some(n => n.i === m.i)), ...page.messages].slice(-200))
  cursor = page.end
  const statusResponse = yield* request(socket,{action:'status'}).pipe(Effect.timeout('5 seconds'))
  const status = Schema.decodeUnknownSync(Schema.Struct({value:Status}))(statusResponse).value
  registry.set(statusAtom,status)
  registry.update(samplesAtom, old => [...old,status.contextBytes].slice(-52))
  registry.set(connectionAtom,status.working ? 'Working' : 'Connected')
 })
 const live = Stream.fromSchedule(Schedule.spaced('500 millis')).pipe(Stream.mapEffect(() => poll().pipe(Effect.catch(error => Effect.sync(() => registry.set(connectionAtom,'Disconnected: '+String(error)))))),Stream.runDrain)
 const older = Effect.fn('Chat.older')(function* () {
  const before = registry.get(messagesAtom)[0]?.i
  if (before === undefined || before === 0) return
  const response = yield* request(socket,{action:'history',before,limit:40}).pipe(Effect.timeout('5 seconds'))
  const page = Schema.decodeUnknownSync(Schema.Struct({value:History}))(response).value
  if (page.messages.length) registry.update(messagesAtom, old => [...page.messages, ...old.filter(m => !page.messages.some(n => n.i === m.i))].sort((a,b)=>a.i-b.i).slice(0,200))
 })
 return {live, older, run, close, send: (text:string,queue=false) => request(socket,{action:'send',text,ack:true,...(queue?{queue:true}:{})},true), inspect: (payload:object) => request(socket,payload)}
}

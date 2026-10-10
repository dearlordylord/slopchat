import {test,expect} from 'bun:test'
import {Effect,Clock,Fiber} from 'effect'
import {TestClock} from 'effect/testing'
import * as Registry from 'effect/reactivity/AtomRegistry'
import {makeContextController} from './context-controller'

test('context timeout uses injected virtual time and finalizes the read',async()=>{
 await Effect.runPromise(Effect.scoped(Effect.gen(function*(){
  const clock=yield* TestClock.make()
  const registry=Registry.make()
  let stopped=false
  const controller=makeContextController({inspect:()=>Effect.never.pipe(Effect.ensuring(Effect.sync(()=>{stopped=true})))},clock)
  const release=registry.mount(controller.page)
  try{
   expect(registry.get(controller.page)._tag).toBe('Initial')
   yield* clock.adjust('5 seconds')
   yield* Effect.promise(()=>new Promise<void>(resolve=>{
    if(registry.get(controller.page)._tag==='Failure'){resolve();return}
    const unsubscribe=registry.subscribe(controller.page,result=>{if(result._tag==='Failure'){unsubscribe();resolve()}})
   }))
   expect(stopped).toBe(true)
   expect(registry.get(controller.page)._tag).toBe('Failure')
  }finally{release();registry.dispose()}
 })))
})

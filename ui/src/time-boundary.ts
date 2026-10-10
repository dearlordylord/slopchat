import {Clock,Effect} from 'effect'

/** Runtime adapter: consumers receive completion, never read wall-clock time. */
export function expireConfirmation(onExpire:()=>void,clock?:Clock.Clock){
 const effect=Effect.sleep('1 second').pipe(Effect.andThen(Effect.sync(onExpire)))
 const fiber=Effect.runFork(clock?Effect.provideService(effect,Clock.Clock,clock):effect)
 return ()=>fiber.interruptUnsafe()
}

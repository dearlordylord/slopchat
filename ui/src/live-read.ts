import { Effect } from 'effect'
import { request } from './transport'
for (const action of ['history','status']) { const value=await Effect.runPromise(request('/workspace/formal-proofs/slopchat/.chats/main/session.sock',{action,limit:2}).pipe(Effect.timeout('5 seconds'))); console.log(action,JSON.stringify(value).slice(0,1000)) }

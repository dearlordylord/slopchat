import { createConnection } from 'node:net'
import { Effect, Schema } from 'effect'
export class TransportError extends Schema.TaggedError<TransportError>()('TransportError', { message: Schema.String, unknownOutcome: Schema.Boolean }) {}
const Response = Schema.Struct({ status: Schema.String, value: Schema.optionalKey(Schema.Unknown), text: Schema.optionalKey(Schema.String), message: Schema.optionalKey(Schema.String) })
export const request = Effect.fn('Socket.request')((socket: string, payload: object, sending = false) => Effect.callback<unknown, TransportError>((resume) => {
 let pending = ''; let wrote = false; let done = false
 const client = createConnection(socket)
 client.setEncoding('utf8')
 const finish = (effect: Effect.Effect<unknown, TransportError>) => { if (!done) { done = true; resume(effect); client.destroy() } }
 client.on('connect', () => { wrote = true; client.write(JSON.stringify(payload) + '\n') })
 client.on('data', (chunk) => { pending += chunk.toString('utf8'); if (pending.length > 4000000) return finish(Effect.fail(new TransportError({message: 'Response too large', unknownOutcome: sending && wrote}))); const end = pending.indexOf('\n'); if (end >= 0) { try { const response = Schema.decodeUnknownSync(Response)(JSON.parse(pending.slice(0,end))); finish(response.status === 'error' ? Effect.fail(new TransportError({message: response.message ?? 'Server error', unknownOutcome: false})) : Effect.succeed(response)) } catch (error) { finish(Effect.fail(new TransportError({message: String(error), unknownOutcome: sending && wrote}))) } } })
 client.on('error', (error) => finish(Effect.fail(new TransportError({message: error.message, unknownOutcome: sending && wrote}))))
 client.on('close', () => { if (!done) finish(Effect.fail(new TransportError({message: 'Connection closed; resync before retrying', unknownOutcome: sending && wrote}))) })
 return Effect.sync(() => client.destroy())
}))

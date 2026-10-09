import {App} from './app'
import type {makeClient} from './client'
import type {ViewSession} from './view-session'
import type * as Atoms from './state'
export const hostApiVersion=1
export const revisionLabel='OpenCode dark'
export function View({host}:{host:{client:ReturnType<typeof makeClient>;session:ViewSession;atoms:typeof Atoms}}){return <App conference client={host.client} session={host.session} atoms={host.atoms}/>}

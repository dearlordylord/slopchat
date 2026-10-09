import {pinHostAtoms} from './host-atoms'
import { resolve } from 'node:path'
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { RegistryContext } from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import { Effect, Fiber } from 'effect'
import { makeClient } from './client'
import { App } from './app'
import {LiveBoundary} from './live-boundary'
import {makeViewSession} from './view-session'
import * as atoms from './state'
const directory=resolve(process.argv[2]??'../.chats/main');
const registry=Registry.make();
const unpin=pinHostAtoms(registry);
const client=makeClient(resolve(directory,'session.sock'),registry);
const fiber=Effect.runFork(client.live);
const renderer=await createCliRenderer({exitOnCtrlC:true});
renderer.on('destroy',()=>{void Promise.all([Effect.runPromise(Fiber.interrupt(fiber)), client.close()]).finally(() => {unpin();registry.dispose()})});
const session=makeViewSession();
const host={client,session,atoms,App:()=> <App client={client} session={session} atoms={atoms}/>};
createRoot(renderer).render(<RegistryContext.Provider value={registry}><LiveBoundary directory={resolve(process.env.SLOPCHAT_UI_REVISIONS??resolve(import.meta.dir,'../.revisions'))} host={host}/></RegistryContext.Provider>);

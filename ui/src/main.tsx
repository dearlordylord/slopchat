import {pinHostAtoms} from './host-atoms'
import { resolve } from 'node:path'
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { RegistryContext } from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import { Effect, Fiber } from 'effect'
import { makeClient } from './client'
import {ManualBoundary,type View} from './manual-boundary'
import {listenForReload} from './manual-reload'
import {makeViewSession} from './view-session'
import * as atoms from './state'
const directory=resolve(process.argv[2]??'../.chats/main');
const registry=Registry.make();
const unpin=pinHostAtoms(registry);
const client=makeClient(resolve(directory,'session.sock'),registry);
const fiber=Effect.runFork(client.live);
const renderer=await createCliRenderer({exitOnCtrlC:false});
renderer.on('destroy',()=>{void Promise.all([Effect.runPromise(Fiber.interrupt(fiber)), client.close()]).finally(() => {unpin();registry.dispose()})});
const session=makeViewSession();
let apply:(view:View)=>Promise<void>=async()=>{throw new Error('UI not ready')};
const reload=await listenForReload(async file=>{const candidate=await import(file);if(candidate.hostApiVersion!==1||typeof candidate.View!=='function')throw new Error('Incompatible view API');await apply(candidate.View)});
renderer.on('destroy',()=>{void reload.close()});
createRoot(renderer).render(<RegistryContext.Provider value={registry}><ManualBoundary host={{client,session,atoms}} register={next=>{apply=next}}/></RegistryContext.Provider>);

import { resolve } from 'node:path'
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { RegistryContext } from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import { Effect, Fiber } from 'effect'
import { makeClient } from './client'
import { App } from './app'
const directory=resolve(process.argv[2]??'../.chats/main');
const registry=Registry.make();
const client=makeClient(resolve(directory,'session.sock'),registry);
const fiber=Effect.runFork(client.live);
const renderer=await createCliRenderer({exitOnCtrlC:true});
renderer.on('destroy',()=>{void Promise.all([Effect.runPromise(Fiber.interrupt(fiber)), client.close()]).finally(() => registry.dispose())});
createRoot(renderer).render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>);

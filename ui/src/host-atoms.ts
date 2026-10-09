import * as atoms from './state'
import type * as Registry from 'effect/reactivity/AtomRegistry'
export const hostAtoms=atoms
export function pinHostAtoms(registry:Registry.AtomRegistry){const releases=[registry.mount(atoms.messagesAtom),registry.mount(atoms.statusAtom),registry.mount(atoms.connectionAtom),registry.mount(atoms.samplesAtom)];return ()=>{for(const release of releases)release()}}

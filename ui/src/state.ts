import * as Atom from 'effect/reactivity/Atom'
import type { Message, Status } from './protocol'
export const messagesAtom = Atom.make<ReadonlyArray<Message>>([])
export const statusAtom = Atom.make<Status | undefined>(undefined)
export const connectionAtom = Atom.make('Connecting')
export const samplesAtom = Atom.make<ReadonlyArray<number>>([])
export const countAtom = Atom.make(get => get(statusAtom)?.count ?? 0)

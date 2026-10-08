import { Effect, Schedule, Stream } from "effect"
import * as Atom from "effect/reactivity/Atom"

export interface Simulation {
  readonly tick: number
  readonly paused: boolean
  readonly page: "metrics" | "memory"
  readonly stress: boolean
  readonly selected: number
  readonly samples: ReadonlyArray<number>
}
export const initialState = (): Simulation => ({ tick: 0, paused: false, page: "metrics", stress: false, selected: 0, samples: Array.from({ length: 52 }, (_, i) => sample(i)) })
const sample = (tick: number) => Math.round(45 + 24 * Math.sin(tick / 5) + 10 * Math.cos(tick / 2))
export const stateAtom = Atom.make(initialState())
export const advance = (state: Simulation): Simulation => state.paused ? state : ({ ...state, tick: state.tick + 1, samples: [...state.samples.slice(1), sample(state.tick + 52)] })
// Mounting this stream atom owns its fiber; unmount/disposal interrupts it.
export const clockAtom = Atom.make((get) => Stream.fromSchedule(Schedule.spaced("250 millis")).pipe(
  Stream.mapEffect(Effect.fn("Prototype.tick")(() => Effect.sync(() => {
    get.set(stateAtom, advance(get.once(stateAtom)))
    return get.once(stateAtom).tick
  }))),
), { initialValue: 0 })
export const sparkAtom = Atom.make((get) => {
  const bars = "▁▂▃▄▅▆▇█"
  return get(stateAtom).samples.map((n) => bars[Math.min(7, Math.floor(n / 100 * 8))]).join("")
})

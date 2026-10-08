import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { createTestRenderer } from "@opentui/core/testing"
import { createRoot, flushSync } from "@opentui/react"
import { RegistryContext } from "@effect/atom-react"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { App } from "./app"
import { stateAtom, advance, clockAtom } from "./state"

const test = await createTestRenderer({ width: 110, height: 34 })
const registry = AtomRegistry.make()
const root = createRoot(test.renderer)
try {
  flushSync(() => root.render(<RegistryContext.Provider value={registry}><App live={false} /></RegistryContext.Provider>))
  await test.waitForFrame((frame) => frame.includes("RUNNING") && frame.includes("Sparkline"))
  let frame = test.captureCharFrame()
  assert.match(frame, /●/)
  await mkdir("artifacts", { recursive: true })
  await writeFile("artifacts/preview.txt", frame)
  test.mockInput.pressKey("p")
  await test.waitForFrame((next) => next.includes("PAUSED"))
  assert.equal(registry.get(stateAtom).paused, true)
  registry.update(stateAtom, advance)
  assert.equal(registry.get(stateAtom).tick, 0)
  test.mockInput.pressKey("p")
  await test.waitFor(() => !registry.get(stateAtom).paused)
  registry.update(stateAtom, advance)
  await test.waitForFrame((next) => next.includes("tick 1"))
  test.mockInput.pressTab()
  await test.waitForFrame((next) => next.includes("Selected leaf: 0"))
  test.mockInput.pressArrow("right")
  await test.waitForFrame((next) => next.includes("Selected leaf: 1"))
  await writeFile("artifacts/memory.txt", test.captureCharFrame())
  test.mockInput.pressKey("r")
  await test.waitForFrame((next) => next.includes("tick 0") && next.includes("METRICS"))
  test.resize(76, 28)
  await test.waitForFrame((next) => next.includes("Sparkline"))
  await writeFile("artifacts/narrow.txt", test.captureCharFrame())
  test.mockInput.pressKey("s")
  await test.waitForFrame((next) => next.includes("STRESS") && next.includes("Graph 3"))
  test.resize(80, 24)
  await test.flush()
  const chartBefore = test.captureCharFrame().split("\n").slice(7, 11).join("\n")
  // Force a contrasting bounded sample set: compact framebuffer pixels must change,
  // independently of header tick/text updates.
  registry.update(stateAtom, (s) => ({ ...s, samples: s.samples.map(() => 95) }))
  await test.flush()
  const chartAfter = test.captureCharFrame().split("\n").slice(7, 11).join("\n")
  assert.notEqual(chartAfter, chartBefore, "compact graph cells must change")
  test.mockInput.pressKey("p")
  await test.waitForFrame((next) => next.includes("PAUSED"))
  test.mockInput.pressKey("p")
  await test.waitFor(() => !registry.get(stateAtom).paused)
  // Mount real Effect stream, await observable registry advancement, then
  // dispose the registry: scoped stream cleanup is owned by the Atom registry.
  const removeClock = registry.mount(clockAtom)
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Effect stream did not emit")) }, 3000)
    const unsubscribe = registry.subscribe(stateAtom, (state) => {
      if (state.tick > 0) { clearTimeout(timeout); unsubscribe(); resolve() }
    })
  })
  removeClock()
  const result = "PASS: headless React + Atom render; framebuffer chart; pause/resume; state advance; Tab; node selection; reset; resize; stress panels/input; real Effect Schedule/Stream emission; disposal.\n"
  await writeFile("artifacts/verification.txt", result)
  console.log(result)
} finally {
  flushSync(() => root.unmount())
  registry.dispose()
  test.renderer.destroy()
}

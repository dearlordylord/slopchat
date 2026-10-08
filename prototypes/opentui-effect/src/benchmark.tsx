import { mkdir, readFile, writeFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { performance } from "node:perf_hooks"
import { createTestRenderer } from "@opentui/core/testing"
import { createRoot, flushSync } from "@opentui/react"
import { RegistryContext } from "@effect/atom-react"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { App } from "./app"
import { stateAtom, initialState, advance } from "./state"

const baselineOnly = process.argv.includes("--baseline")
const iterations = Number(process.argv.slice(2).find((arg) => arg !== "--baseline") ?? 40)
if (!Number.isSafeInteger(iterations) || iterations < 5 || iterations > 500) throw new Error("iterations must be integer 5..500")
const mib = (bytes: number) => Math.round(bytes / 1048576 * 100) / 100
const percentile = (values: number[], ratio: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * ratio) - 1] ?? 0
const results = []
for (const [width, height] of baselineOnly ? [[120, 40]] : [[80, 24], [120, 40], [180, 60]]) {
  Bun.gc(true)
  const memoryBefore = process.memoryUsage()
  const test = await createTestRenderer({ width, height })
  const registry = AtomRegistry.make()
  registry.set(stateAtom, { ...initialState(), stress: !baselineOnly })
  const root = createRoot(test.renderer)
  let peakRss = memoryBefore.rss
  let peakHeap = memoryBefore.heapUsed
  try {
    const initialStart = performance.now()
    flushSync(() => root.render(<RegistryContext.Provider value={registry}><App live={false} /></RegistryContext.Provider>))
    await test.waitForFrame((frame) => (baselineOnly ? frame.includes("METRICS") && frame.includes("Sparkline") : frame.includes("STRESS") && frame.includes("Graph 3")))
    const initialMs = performance.now() - initialStart
    await mkdir("artifacts", { recursive: true })
    await writeFile(`artifacts/${baselineOnly ? "baseline" : "stress"}-${width}x${height}.txt`, test.captureCharFrame())
    const durations: number[] = []
    for (let i = 0; i < iterations + 5; i++) {
      const start = performance.now()
      registry.update(stateAtom, advance)
      await test.waitForFrame((frame) => frame.includes(`tick ${i + 1} `))
      if (i >= 5) durations.push(performance.now() - start)
      const memory = process.memoryUsage()
      peakRss = Math.max(peakRss, memory.rss)
      peakHeap = Math.max(peakHeap, memory.heapUsed)
    }
    const inputStart = performance.now()
    test.mockInput.pressKey("p")
    await test.waitForFrame((frame) => frame.includes("PAUSED"))
    const pauseKeyMs = performance.now() - inputStart
    assert.equal(registry.get(stateAtom).paused, true)
    const frozen = registry.get(stateAtom).tick
    registry.update(stateAtom, advance)
    assert.equal(registry.get(stateAtom).tick, frozen)
    const memoryEnd = process.memoryUsage()
    peakRss = Math.max(peakRss, memoryEnd.rss)
    peakHeap = Math.max(peakHeap, memoryEnd.heapUsed)
    results.push({ mode: baselineOnly ? "normal" : "stress", workload: baselineOnly ? { panels: 1, framebufferLineCharts: 1, scrollableLogs: 0, historySamples: 52 } : { panels: 6, framebufferLineCharts: 3, scrollableLogs: 3, linesPerLog: 200, historySamples: 52 }, width, height, iterations, initialRenderMs: initialMs, updateRenderMs: { p50: percentile(durations, .5), p95: percentile(durations, .95), max: Math.max(...durations) }, pauseKeyMs, memoryMiB: { rssBefore: mib(memoryBefore.rss), rssPeak: mib(peakRss), heapBefore: mib(memoryBefore.heapUsed), heapPeak: mib(peakHeap), rssEnd: mib(memoryEnd.rss), heapEnd: mib(memoryEnd.heapUsed) }, nativeStats: test.getNativeStats() })
  } finally {
    flushSync(() => root.unmount())
    registry.dispose()
    test.renderer.destroy()
  }
}
const report = { measuredAt: new Date().toISOString(), runtime: `Bun ${Bun.version}`, platform: `${process.platform}/${process.arch}`, workload: { panels: 6, framebufferLineCharts: 3, scrollableLogs: 3, linesPerLog: 200, historySamples: 52, cadence: "bounded as-fast-as-rendered updates; five warmups", liveStream: false }, limitations: "Headless CPU/native-render timings include React scheduling and test-renderer flush; not terminal throughput or actual interactive FPS. Memory is process-level in a sequential benchmark and includes native allocations/JIT; peak is sampled, not continuous.", results }
if (baselineOnly) {
  const previous: { results: Array<Record<string, unknown>> } = JSON.parse(await readFile("artifacts/performance.json", "utf8"))
  const merged = { ...previous, baselineMeasuredAt: report.measuredAt, results: [...previous.results.filter((result) => result.mode !== "normal").map((result) => ({ ...result, mode: "stress" })), ...results] }
  await writeFile("artifacts/performance.json", JSON.stringify(merged, null, 2) + "\n")
} else {
  await writeFile("artifacts/performance.json", JSON.stringify(report, null, 2) + "\n")
}
console.log(JSON.stringify(report, null, 2))

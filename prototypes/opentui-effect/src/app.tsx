import { useAtomValue, useAtomSet } from "@effect/atom-react"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { stateAtom, clockAtom, sparkAtom, initialState } from "./state"
import "./chart"

function Clock() { useAtomValue(clockAtom); return null }
export function App({ live = true }: { live?: boolean }) {
  const state = useAtomValue(stateAtom)
  const spark = useAtomValue(sparkAtom)
  const setState = useAtomSet(stateAtom)
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  useKeyboard((key) => {
    if (key.name === "q" || (key.ctrl && key.name === "c")) renderer.destroy()
    if (key.name === "space" || key.name === "p") setState((s) => ({ ...s, paused: !s.paused }))
    if (key.name === "s") setState((s) => ({ ...s, stress: !s.stress }))
    if (key.name === "r") setState(initialState())
    if (key.name === "tab") setState((s) => ({ ...s, page: s.page === "metrics" ? "memory" : "metrics" }))
    if (key.name === "left") setState((s) => ({ ...s, selected: Math.max(0, s.selected - 1) }))
    if (key.name === "right") setState((s) => ({ ...s, selected: Math.min(3, s.selected + 1) }))
  })
  const latest = state.samples.at(-1) ?? 0
  return <box flexDirection="column" width="100%" height="100%" backgroundColor="#0b1220" padding={1} gap={1}>
    {live && <Clock />}
    <text fg="#42d9e8">SLOPCHAT LAB · OpenTUI React + Effect 4 Atom · ARTIFICIAL DATA</text>
    <text fg="#c6d6ec">{`${state.stress ? "STRESS · 6 PANELS" : state.page.toUpperCase()}  |  ${state.paused ? "PAUSED" : "RUNNING"}  |  tick ${state.tick}  |  sample ${latest}/100`}</text>
    {state.stress ? <StressPanels width={width} height={height} tick={state.tick} samples={state.samples} /> : state.page === "metrics" ? <box flexDirection="column" border borderColor="#32445b" title="Custom OpenTUI framebuffer · line chart" padding={1}>
      <metricsChart width={Math.max(20, Math.min(100, width - 8))} height={12} samples={state.samples} />
      <text fg="#b59bff">{`Sparkline  ${spark}`}</text>
      <text fg="#7edf9e">{`Load       ${"█".repeat(Math.round(latest / 4))}${"░".repeat(25 - Math.round(latest / 4))} ${latest}%`}</text>
    </box> : <box flexDirection="column" border borderColor="#32445b" title="Synthetic memory topology · select leaf with ← →" padding={1} height={18}>
      <text fg="#42d9e8">{"                   [summary 0–3]\n                    ┌────┴────┐\n                [0–1]       [2–3]\n                ┌─┴─┐       ┌─┴─┐\n                0   1       2   3"}</text>
      <text fg="#b59bff">{`Selected leaf: ${state.selected} · ${["user request", "agent reply", "tool result", "follow-up"][state.selected]}`}</text>
      <text fg="#c6d6ec">This diagram is textual. The metrics chart above uses a native framebuffer.</text>
    </box>}
    <text fg="#c6d6ec">Space/P pause · S stress · R reset · Tab metrics/memory · ←/→ select · Q quit</text>
    <text fg="#73869f">Local experiment only · no model calls · no Lisp server · no persistence</text>
  </box>
}


export function StressPanels({ width, height, tick, samples }: { width: number; height: number; tick: number; samples: ReadonlyArray<number> }) {
  const paneWidth = Math.max(16, Math.floor((width - 4) / 3))
  const paneHeight = Math.max(5, Math.floor((height - 11) / 2))
  return <box flexDirection="column" gap={1}>
    <box flexDirection="row" gap={1}>
      {[0, 1, 2].map((panel) => <box key={panel} width={paneWidth} height={paneHeight} border borderColor="#32445b" title={`Graph ${panel + 1}`}>
        <metricsChart width={Math.max(10, paneWidth - 2)} height={Math.max(3, paneHeight - 2)} samples={samples.map((n) => (n + panel * 13) % 100)} />
      </box>)}
    </box>
    <box flexDirection="row" gap={1}>
      {[0, 1, 2].map((panel) => <scrollbox key={panel} width={paneWidth} height={paneHeight} border borderColor="#32445b" title={`Log ${panel + 1} · 200 lines`}>
        <text fg="#91aac7">{Array.from({ length: 200 }, (_, line) => `[${String(line).padStart(3, "0")}] tick=${tick} panel=${panel} synthetic event payload ` + "bounded text ".repeat(5)).join("\n")}</text>
      </scrollbox>)}
    </box>
  </box>
}

# OpenTUI + Effect Atom compatibility prototype

Throwaway experiment: can OpenTUI's React renderer use Effect 4 Atom state and a scoped Effect stream while displaying terminal charts and a node diagram? **Verdict: yes** for the tested versions and Bun runtime. Headless rendering, reactive updates, keyboard actions, resize, and an actual scheduled Effect stream pass. This is synthetic data, not a SlopChat implementation.

From the repository root, with Bun 1.3.14 or later:

```sh
bun install --cwd prototypes/opentui-effect
bun run --cwd prototypes/opentui-effect start
```

After installation, the second command alone starts the interface. No API keys, model calls, Ouro processes, Lisp server, Unix socket connection, or persistence are involved.

## What to try

- `Space` or `P`: pause/resume simulation.
- `S`: toggle stress view: six panels, three framebuffer charts and three scrollable logs of 200 lines each.
- `R`: reset samples and return to metrics.
- `Tab`: switch metrics/memory diagram.
- `Left` / `Right`: select a synthetic memory leaf.
- `Q` or `Ctrl+C`: quit.

The simulation advances every 250 ms. A writable Atom stores state; a derived Atom computes the sparkline; a stream Atom owns an Effect `Schedule` → `Stream` producer. React hooks subscribe through `@effect/atom-react`. Unmounting/disposal releases the producer.

The line chart is a **custom `FrameBufferRenderable`** registered with OpenTUI React. It draws colored cells into OpenTUI's native optimized framebuffer; it is not a built-in chart package, image/Sixel chart, or termDRAW integration. Sparkline and bar use Unicode text. Charts shorter than seven rows hide axes/footer and use the full buffer height, so the 80 × 24 stress case still has changing graph cells (verified by smoke assertion). The memory view is a small textual node/edge diagram with keyboard selection; automatic graph layout, pan/zoom, mouse interaction, and editable diagrams are outside this experiment.

## Exact package pins

| Package | Version |
| --- | --- |
| `effect` | `4.0.2` |
| `@effect/atom-react` | `4.0.2` |
| `@opentui/core` | `0.5.17` |
| `@opentui/react` | `0.5.17` |
| `react` | `19.3.0` |
| `scheduler` | `0.27.0` |
| `react-devtools-core` | `7.0.1` |
| `ws` | `8.18.3` |

Versions and peers were verified against npm metadata and installed package source. Effect 4.0.2 is published as stable; its Atom APIs still carry `@stability unstable` annotations. The lockfile captures transitive dependencies. Bun 1.3.14 on Linux arm64 was used; Node was not tested.

## Verification and previews

```sh
bun run --cwd prototypes/opentui-effect typecheck
bun run --cwd prototypes/opentui-effect smoke
bun run --cwd prototypes/opentui-effect benchmark
bun run --cwd prototypes/opentui-effect benchmark --baseline 200
bun run --cwd prototypes/opentui-effect perf:pty
```

The smoke script uses the actual OpenTUI test renderer and React reconciler, injects a scoped Atom registry, and sends keyboard events. It verifies the framebuffer chart, pause/resume, deterministic state advancement, tab switching, selected leaf, reset, terminal resize, stress-mode input, and real scheduled stream emission. Registry and renderer are disposed at the end.

Saved character snapshots (colors are visible in the live terminal):

- [Metrics, 110 × 34](artifacts/preview.txt)
- [Memory diagram](artifacts/memory.txt)
- [Metrics, 76 × 28](artifacts/narrow.txt)
- [Verification output](artifacts/verification.txt)

The useful result is compatibility, not a production architecture decision. The real integration still needs transport/event mapping, disconnection handling, chat widgets, and a chosen diagram library or custom graph component.


## Bounded performance experiment

`bun run --cwd prototypes/opentui-effect benchmark` measures 40 state/render updates after five warmups at each size (optional final argument: iteration count, 5–500). Workload: six panels, three framebuffer charts of 52 samples, three scrollable logs totaling 600 synthetic lines. Every update changes all log text and charts; histories remain bounded. The benchmark records initial render, update p50/p95/max, pause-key-to-render latency, and sampled process RSS/heap.

Recorded run: `bun run --cwd prototypes/opentui-effect benchmark 200` (200 measured updates per size), Linux arm64 Docker, Bun 1.3.14. Pause-key latency is one sample per size:

| Terminal cells | Initial render | Update p50 | Update p95 | Pause-key render | Sampled RSS peak |
| --- | --- | --- | --- | --- | --- |
| 80 × 24 | 91.4 ms | 21.8 ms | 46.8 ms | 6.6 ms | 166.4 MiB |
| 120 × 40 | 72.6 ms | 21.5 ms | 77.2 ms | 16.4 ms | 167.5 MiB |
| 180 × 60 | 41.5 ms | 20.4 ms | 35.4 ms | 11.8 ms | 174.6 MiB |

**Verdict:** the panels and input work under this load, with median update times near 20–22 ms. Tail latency varies: one size reached p95 77 ms and max 241 ms, so this run does not demonstrate uniformly smooth rendering. Timings include React/Atom scheduling and test-renderer frame flushing. They are **not terminal-emulator paint FPS or PTY throughput**. First-size initialization includes cold startup/JIT; later sizes reuse the same process. RSS before/peak/end and heap before/peak/end are in the raw report. Memory includes native allocations/JIT and prior runs, with sampled rather than continuous peaks. This short experiment does not establish long-run leak behavior. Run on the actual terminal/device before choosing production budgets.

- [Raw measurement report](artifacts/performance.json)
- [Stress preview, 80 × 24](artifacts/stress-80x24.txt)
- [Stress preview, 120 × 40](artifacts/stress-120x40.txt)
- [Stress preview, 180 × 60](artifacts/stress-180x60.txt)


### Normal-view baseline

An additional 200-update baseline at 120 × 40 renders the normal metrics view (one framebuffer chart, sparkline, bar; no heavy logs). It preserves the stress results in `performance.json`:

- Update p50: **23.2 ms**; p95: **55.9 ms**; max: **173.9 ms**.
- Initial render: 148.2 ms; one pause-key sample: 18.3 ms.
- Sampled process RSS before/peak/end: 107.1/140.0/140.0 MiB.

The normal baseline and stress measurements are separate process runs; they share the same headless scheduling/flush overhead and environment variability, so use this as a rough comparison rather than a precise incremental cost estimate.

### Drained PTY probe

`perf:pty` runs the actual interactive app in a Python-stdlib pseudo-terminal, sets 120 × 40, switches to stress, drains output for five seconds, pauses, then quits. The reproducible script is [scripts/pty-probe.py](scripts/pty-probe.py). It waits 0.5 seconds after the title before sending initial input; readiness before React effects install has not been tested. Cleanup terminates the probe-owned process group on failure.

The latest recorded run observed 20 completed synchronized ANSI frames in 5.006 seconds and 61,822 bytes (~12.3 kB/s), at the simulation's configured **4 Hz**, with 9.75 ms pause acknowledgement and clean terminal restoration/exit. This measures emitted/drained ANSI data, **not terminal emulator painting or maximum FPS**. [Raw PTY report](artifacts/pty-performance.json).

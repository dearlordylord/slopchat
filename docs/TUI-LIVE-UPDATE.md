# Updating Ouro's running TUI

Research date: 2026-10-08. This document proposes an implementation; it does not enable live updates in the production UI. The disposable headless experiment below supports the architecture within its stated limits.

## Recommendation

Give Ouro a **publish validated UI revision** operation. Keep the terminal renderer, React root, Effect registry, transport and essential interaction state in a stable host. Load a new immutable view bundle only after checks pass, then replace the view inside the existing React tree. A failed build leaves the current view running. A failed activation returns to the previous revision.

This is more predictable for this application than applying Bun `--hot` to its current entrypoint. Supporting updates to arbitrary dependency/runtime code in the same process is outside this initial mechanism.

The currently running UI has no revision loader or update bridge. Installing this architecture requires **one initial client restart**. After that, supported view revisions can update without restarting the client. The separate Ouro/Emacs agent process need not restart for this client migration.

## Installed baseline and current ownership

The inspected `ui/package.json` pins OpenTUI core/react 0.5.17, React 19.3.0, Effect and atom-react 4.0.2, scheduler 0.27.0. The installed Bun executable reports 1.3.14. Official Bun documentation currently describes a newer release, so implementation must use the installed runtime's behavior and API declarations as well as the docs.

`ui/src/main.tsx` currently constructs the Atom registry, client, live Effect fiber, renderer and React root at module top level. Renderer destruction interrupts the live fiber, closes client requests and disposes the registry. Preserve that lifecycle in a host loaded once.

`ui/src/app.tsx` stores draft text inside an imperative OpenTUI textarea; focus, selected memory node, result message and composer height are React local state. Its pending-send set is a ref. `ui/src/client.ts` owns polling cursor and pending request fibers. `ui/src/state.ts` exports the actual Atom identities used by both client and view. `ui/src/chart.ts` registers a custom renderable through a module-level `extend` call. These are concrete boundaries that must be addressed before safe revision replacement.

## What the available mechanisms mean

| Mechanism | What it changes | Suitability |
| --- | --- | --- |
| Bun `--watch` | Restarts the running process | Does not meet the request |
| Bun `--hot` | Reevaluates application modules; global state survives | Useful experiment, unsafe on current top-level setup |
| React reconciliation | Preserves state when component identity and position remain compatible | Does not identify a newly imported component as its predecessor automatically |
| React Fast Refresh | Bundler transform/runtime coordinates component families | Additional integration, not supplied by ordinary Bun runtime hot reload |
| Stable host + revision bundle | Explicitly replaces only the view while host objects persist | Recommended initial design |

Bun documents that hot mode excludes `node_modules` from its source watch graph, reevaluates source modules and preserves `globalThis`. It also describes module-cache reset and synchronous garbage collection. Retaining a host in `globalThis` therefore avoids repeated host construction, but does not by itself provide cleanup of old UI subscriptions or stable Atom identities. Bun's browser refresh and runtime hot mode are separate mechanisms. [Bun watch/hot documentation](https://bun.sh/docs/runtime/watch-mode)

React associates local state with component type, position and keys. A new imported `App` function is a different component type; mounting it can reset local hooks and recreate terminal renderables. Saving state in a registry outside the replaceable component avoids relying on incidental hook preservation. [React state preservation](https://react.dev/learn/preserving-and-resetting-state)

Fast Refresh is a bundler integration using `react-refresh`, rather than a consequence of changing a JavaScript module. Its runtime contains component-family registration and renderer integration. OpenTUI's inspected renderer wires DevTools, but no refresh integration was found in its installed renderer chunks. Building this integration is a separate project and still requires fallback remounts for incompatible edits. [React Refresh README](https://github.com/facebook/react/blob/main/packages/react-refresh/README.md), [React Refresh runtime](https://raw.githubusercontent.com/facebook/react/main/packages/react-refresh/src/ReactFreshRuntime.js)

### Important OpenTUI root detail

In installed `@opentui/react` 0.5.17, `createRoot().render()` calls `_render`, which creates a reconciler container each time. Its cleanup closes the container most recently captured. Do not assume repeated calls to `root.render(newView)` update the same container or dispose all previous work. Mount a stable boundary once, and have that boundary subscribe to revision state. The installed evidence is `ui/node_modules/@opentui/react/chunk-r98m55jk.js`, functions `_render` and `createRoot2`; upstream source corroborates this shape but is not a version-pinned substitute. [OpenTUI renderer source](https://raw.githubusercontent.com/anomalyco/opentui/main/packages/react/src/reconciler/renderer.ts), [OpenTUI reconciler source](https://raw.githubusercontent.com/anomalyco/opentui/main/packages/react/src/reconciler/reconciler.ts)

## Proposed architecture

```text
Ouro edits source
  -> typecheck + tests + headless candidate smoke
  -> immutable view-<revision>.mjs + manifest
  -> atomically publish revision pointer
                 |
stable Bun host notices pointer
  -> import candidate -> check host API version
  -> stable React boundary changes view
  -> activation acknowledged / previous view restored

host owns: renderer / root / registry / client / pending sends / draft state
revision owns: layout / presentation components / disposable view effects
```

1. Split bootstrap and view. Start the host normally, without automatic source reevaluation. Mount its React boundary and provider once. Host owns shutdown and local update subscription.
2. Move essential session state into host-owned atoms or a host service: draft, cursor/selection, focus target, selected memory ID, scroll position/anchor, result and in-flight send bookkeeping. A view remount must not cancel or retransmit a submitted message. The client remains unchanged and continues polling during activation.
3. Give each revision a narrow API such as `hostApiVersion` and `View`, with host services passed as props/context. View imports must not create an independent transport or registry. Keep durable Atom definitions host-owned; passing Atom objects or a stable adapter is safer than allowing the bundle to instantiate copies of `state.ts`.
4. Build one ESM view bundle containing the complete changeable source graph, including theme and ordinary presentation helpers. Use `target: "bun"`, and externalize package dependencies so candidate and host use the same React/OpenTUI/Effect instances. Keep artifacts under the existing `ui/` dependency-resolution tree or explicitly resolve externals. A unique filename for only an unbundled entrypoint is insufficient: unchanged import specifiers of its child modules may remain cached.
5. Do not publish every file write. Ouro explicitly publishes after all files and checks are complete. Write artifacts first and atomically rename the manifest/pointer last. Serialize activations and discard superseded candidates. Publication is separate from source edits and Git commits.
6. Capture textarea content and selection before replacement, then restore through validated OpenTUI APIs after the new textarea mounts. Store logical scroll anchors as well as offsets; changed layout can invalidate a raw coordinate. Keep focus and pending-send data outside the replaced subtree. Preservation needs tests, not a claim based solely on external state.

Bun supports ESM bundling and external dependencies; `packages: "external"` leaves package imports for runtime resolution. This preserves package singleton identity only if all paths resolve to the same installation. Local relative imports still need explicit architecture to avoid bundling host-owned state. Inspect emitted bundles for accidentally bundled React/Effect/OpenTUI. [Bun bundler external/packages options](https://bun.sh/docs/bundler#external)

React hooks require the renderer and components to resolve the same React instance. Duplicating React inside a revision bundle can cause invalid hook calls. Duplicated Atom definitions have a different failure mode: the new UI may subscribe to new atoms while the live client updates the old ones. [React duplicate-instance guidance](https://react.dev/warnings/invalid-hook-call-warning)

## Failure handling and lifecycle

Build/typecheck/import failures should preserve the current mounted view and show a host-owned update result. Candidate module initialization must be inert: no terminal setup, sockets, timers or irreversible catalog changes. Importing a module is not transactional; arbitrary top-level effects cannot be rolled back.

A host-owned error boundary should catch synchronous rendering/lifecycle failures, remount the previous revision, and retain external interaction state. Activation success needs a post-commit acknowledgement rather than assuming import success means rendering success. Async event-handler errors need explicit reporting; an error boundary does not make all failures recoverable. Keep update controls outside the candidate view so a broken view cannot remove recovery access.

Old view keyboard handlers and subscriptions must clean up on unmount. The host's client fiber and registry must only close at final renderer destruction. Custom `extend()` registrations are global mutable state: initially keep chart renderable classes stable, passing colors/data as props. Reloading their implementation requires explicit registration activation/rollback and remount validation.

Loaded ESM revisions can remain in the runtime module cache. Deleting old files does not establish memory reclamation. Measure repeated activations and retain bounded disk artifacts; do not claim indefinite leak-free operation. A future reload count or memory threshold may require a controlled restart with draft recovery.

## Stages and restart boundaries

First implement theme/layout updates with explicit publication, stable host services and draft/focus/scroll restoration. Then test changes to view event handlers and ordinary React components. Fast Refresh, arbitrary chart-class replacement and transport hot swaps can follow only if they solve a measured need.

Require a client restart for changes to the host entrypoint, lifecycle ownership, registry/state schema without a migration, runtime version, dependencies, native OpenTUI library, or incompatible host/view API. Lisp backend changes have a separate reload lifecycle; updating the terminal view does not reload Emacs.

Acceptance should cover unchanged Bun PID and renderer identity; one live polling fiber; no duplicate keyboard handlers; Unicode multiline draft and selection; pending-send acknowledgement during swap; memory selection and history scroll; syntax/import/render failure rollback; and repeated updates with measured memory/resource counts. These tests are the implementation gate before allowing Ouro to publish into the user's active TUI.

## Measured headless findings

The installed Bun 1.3.14 `--hot` probe retained renderer/root in `globalThis` and attempted a component-boundary swap. PID stayed unchanged, but the first component update produced an invalid-hook-call failure and a null `dispatcher.useContext`. `import.meta.hot` was undefined. This establishes that this attempted mechanism failed in the installed combination; it does not isolate the underlying dispatcher/instance problem or prove every possible `--hot` integration impossible.

The separate stable-host experiment uses normal Bun execution, immutable ESM revision bundles, external package dependencies, a mounted-once boundary and a host-owned Atom. Reproduce from the repository root:

```sh
python3 docs/experiments/tui-live-update.py
```

The script creates temporary files inside `ui/`, runs its own headless renderer/process, writes the result and cleans up its process and temporary directory. It does not change production code or contact the live chat. Source: [probe](experiments/tui-live-update.py). Recorded evidence: [result JSON](experiments/tui-live-update-result.json).

| Observed state | PID | Roots/renderers | Host draft | Component local state |
| --- | --- | --- | --- | --- |
| v1 | 3891110 | 1 / 1 | `typed draft` | `changed local` |
| v2 | 3891110 | 1 / 1 | retained | reset to `initial local` |
| Rejected import | 3891110 | 1 / 1 | retained | v2 remained displayed |
| v3 | 3891110 | 1 / 1 | retained | reset to `initial local` |

The expected local-state reset confirms that replacing the component remounts it; persistence came from the external Atom, not Fast Refresh. A syntax-invalid bundle was rejected during build before publication. An import-time exception left v2 active, and a later v3 activation succeeded. Mount count increased from one to three across successful revisions while the recorded host root/renderer counts remained one.

These are headless observations with Bun 1.3.14, OpenTUI 0.5.17, React 19.3.0 and Effect 4.0.2. The draft was an Atom value rendered as text, not an actual textarea. The experiment did not verify textarea content/cursor restoration, focus, scroll, real terminal/PTY behavior, socket continuity, pending sends, render-failure rollback or long-running resource growth. The root/renderer counts describe objects created by this probe, not a general internal allocation audit. Production activation still needs the acceptance checks above.

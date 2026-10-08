# Build SlopChat's own terminal chat interface

You are Ouro, the self-developing Lisp agent running SlopChat. The user has
explicitly asked YOU to implement your own chat interface. Work in
`/workspace/formal-proofs/slopchat`. Implement the result, verify it, and report
how the user can launch it. Do not merely propose a plan.

## Agreed stack and evidence

Use TypeScript + Bun + OpenTUI React + Effect 4 + Effect Atom React. Exact
verified pins are in `prototypes/opentui-effect/package.json`: effect and
@effect/atom-react 4.0.2, @opentui/core and @opentui/react 0.5.17, React 19.3.0.
Read that prototype's README, src, smoke script, and performance artifacts.
The prototype is throwaway evidence, not the production app; preserve it.
The prototype confirmed React/Atom hooks and scoped Effect streams work with
OpenTUI. It has a custom native framebuffer chart (not a bundled chart widget)
and a textual memory diagram. No browser, React DOM, Solid, or Foldkit is needed.

Read README.org, CONTEXT.md, boot.el, lisp/slopchat.el,
lisp/slopchat-cli.el, lisp/slopchat-store.el, scripts/slopchat.py, and existing
tests before editing. Read the local Effect skill at
/home/node/.codex/skills/effect/SKILL.md and only relevant referenced files.
The workspace contains other people's uncommitted work: do not revert it.

## Deliverable

Create the real client in `ui/` with its own pinned package.json, lockfile,
.gitignore, TypeScript settings and concise README. Provide one command from
repository root to launch the chat, defaulting to `.chats/main`; support an
explicit chat directory. Bun is already installed. Installing local packages
and writing needed code/tests/docs are authorized. Keep changes reviewable;
do not create commits, change branches, or touch .references.

The client must connect to the actual existing Lisp chat server using its local
Unix socket and newline-delimited JSON. The chosen directory identifies the
chat. The Lisp agent and durable log/tree remain authoritative. Closing the UI
must leave the agent running; reopening must show saved history, not lose it.
Do not put execution or summarization logic in the client. Preserve the complete
Ouro model: the agent owns eval and its self-written loop, Codex is only the
model adapter. Do not substitute a different coding agent or spawn subagents.
Implement this work yourself through Lisp eval and ordinary build/test tools.

Required experience:

- A scrollable conversation showing user/agent messages and concise tool activity.
- A usable multiline composer: send, edit, paste, Unicode/Russian input, scroll,
  focus changes and visible shortcut help. Choose terminal-safe shortcuts;
  provide a fallback if Ctrl+Enter cannot be distinguished by a terminal.
- Sending calls the actual server's `send` action. Show working, result, error,
  and disconnected states. Preserve drafts on failure. Avoid duplicate sends.
- A second message while an agent is working becomes an existing supported
  clarification/steer. Keep the original reply visible when it completes.
- Restore history from the server at startup. Receive updates during work so
  tool activity and incoming answers are visible. Add a small read-only bounded
  history/status/event protocol to the Lisp socket server if necessary.
  Existing send/note/zoom/date/stop behavior and CLI compatibility must remain.
  Avoid races between initial history and incremental events, fragmented JSONL,
  unbounded output, and hanging subscriptions on client disconnect.
- Memory panel: show the current summary view/tree and open an aligned node with
  existing zoom/date requests. Treat unsummarized messages honestly.
- Include a compact live chart/metrics view using the proven framebuffer pattern
  (e.g. real message count/context bytes/summary activity from server metadata).
  Label real measurements accurately; use no random fake metrics in production.
  A clear textual tree diagram is sufficient for this first implementation.

## State and effects

Use @effect/atom-react for shared UI state and derived values. Use Effect 4 for
transport lifecycle, event streams, typed protocol validation, errors, and
cleanup. Follow installed v4 APIs. React renders snapshots; it does not own
agent execution. Small component-local state is fine. Keep local drafts, focus,
selection, and scroll state distinct from server-authoritative chat data.
Reconnect/resync should be straightforward. Never silently repeat a send after
connection loss: its outcome may be unknown, so resync history and report that.

Keep rendering bounded: virtualize or window large histories, append incrementally,
keep chart samples bounded, avoid rebuilding all long text on every tick, and
avoid rerendering the whole conversation for an unrelated chart change. The
prototype's six-pane/600-line benchmark had median updates ~20-22 ms but tail
spikes up to242 ms. These were headless timings, NOT terminal FPS. Do not claim
smoothness without checking. No database or browser-local storage is needed.

## Execution and validation

You are currently serving `.chats/main`. Do not stop/restart this running server
or close its owning process while doing your task. If new protocol definitions
need to become available, load only the necessary definitions safely in this
Emacs, or have the supervising caller restart after you finish. Do not run the
interactive Bun TUI inside the batch Emacs host; use headless/PTY tools or a
separate subprocess. Use scratch chat directories for server tests; preserve
.chats/main and the existing reference/prototype.

Run TypeScript checking, meaningful headless UI interaction smoke checks,
protocol/transport tests (including partial JSONL, history plus events,
Unicode, reconnect/unknown-send outcomes, clarification and close), and the
existing Emacs tests appropriate to changed server code. Test with enough text
and simultaneous graph/panel updates to catch unbounded render work. Capture a
readable terminal snapshot and a bounded performance report, stating the limits
of headless and PTY measurements. Test actual backend reads against the running
server; mocks alone do not prove integration. Prefer deterministic checks and
bounded probes; never modify the real chat for fabricated benchmark data.

When done, give the exact launch command, relevant paths, tests that passed,
remaining limitations, and whether the supervising caller needs to restart the
server to load your protocol changes. The goal is a working chat client the
user can open now, not a prototype disconnected from the agent.

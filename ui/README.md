# SlopChat terminal client

From the repository root, run `bun install --cwd ui`, then `./scripts/chat-tui`
or `./scripts/chat-tui /absolute/chat/directory`. Start the Lisp server first;
see [the root README](../README.org). The client connects to the selected chat's
`session.sock`.

## Controls

| Key | Action |
| --- | --- |
| Enter | Send the composer message |
| Ctrl+Enter | Insert a newline |
| Tab | Queue input for the next round, or complete a matching slash command |
| Ctrl+F | Switch composer/memory focus |
| Up / Down | Recall up to 100 accepted inputs at the first / last input line; Down restores the draft |
| Up / Down | Select a node while memory has focus |
| Enter / D | Zoom / read the date of the selected memory node |
| Ctrl+P | Load older history |
| Mouse wheel | Scroll |
| Ctrl+O | Toggle the memory map |
| Ctrl+C | Clear input; on empty input press twice within one second to exit |

`/map` and `/chat` switch views locally. Type a prefix and press Tab to complete,
then Enter to execute.

Sending during an active turn steers it. The submitted draft clears after durable
acceptance; text typed meanwhile is preserved. Failed sends retain the draft.
Uncertain send outcomes are not automatically retried. The composer grows with
explicit newlines up to six lines.

New user messages scroll to the end. Assistant replies follow only when already
at the end, allowing older history to remain in view.

## Display and request bounds

The client polls history and status with 500 ms spacing; it does not stream tokens.
The history window holds at most 200 messages, displaying 4,000 characters per
message. Older pages displace newer messages within that window. Memory lists
show the first 40 nodes; the experimental map shows up to 24 with decorative
positions, not inferred tree edges. The chart retains 52 context-byte samples;
bytes are not token counts or costs.

History/status reads time out after five seconds. Send acceptance and memory
inspection have no client timeout. Acceptance follows durable input logging; the
eventual reply arrives through history polling. A disconnect can leave a send
outcome unknown. Read polling reconnects.

## Apply client changes

Relaunch the TUI once to enable explicit reload requests. Then run
`./scripts/chat-tui-reload TUI-PID` to typecheck, build an immutable bundle,
and request replacement through a private local socket. There is no file
watcher or publication polling. The host retains the client, registry and
view session. Render failures restore the previous view; acknowledgement
follows the React commit, not proof of a painted terminal frame. A timeout
means the outcome is unknown: do not automatically retry.

This is an opt-in development operation, not a sandbox. Imported code can
have side effects that rollback cannot undo. Host/chart changes still
require a TUI restart. The Lisp server does not need restarting.

Run `bun run --cwd ui typecheck`, `bun run --cwd ui test`, and
`bun ui/src/smoke.tsx` for local verification.
For palette changes, read [THEME.md](THEME.md).

### Model selector

Type `/models` and press Enter. Use arrows and Enter to select an account-advertised model; Esc cancels. Configured default resets the override. Selection is in-memory, applies to subsequent model responses (not an already-running provider request), and leaves the summary model unchanged. `/m` is now ambiguous; use `/ma` for map completion. Catalog source: Codex `model/list`, not a hard-coded list.

Restart older clients to load updated Ctrl+C handling. The Lisp server is unaffected.

Esc cancels the active model response and round (without stopping the Lisp server or discarding queued inputs). In the model picker, Esc closes the picker. Cancellation is cooperative at host/tool boundaries; arbitrary blocking Lisp cannot be forcibly interrupted.

### Clipboard selection

Mouse selections are copied on release through terminal OSC 52. iTerm2 usually
handles Command+C itself rather than delivering it to the application. If
received, Super+C and Ctrl+Shift+C copy the current selection. Ctrl+C keeps its
clear/exit behavior. Empty selections do not overwrite the clipboard.

Enable application clipboard access in iTerm2. In tmux, inspect
`tmux show -s set-clipboard`; `tmux set -s set-clipboard on` permits application
clipboard writes when disabled. The terminal must advertise OSC 52 (`Ms`).
These are user settings; the application does not modify them. Emitting OSC 52
cannot confirm that the terminal accepted the clipboard write.

Ctrl+Y toggles application mouse reporting. When disabled, select with the terminal and use Command+C. Application clicks are unavailable until Ctrl+Y restores reporting. tmux may still capture drags: use iTerm2 Option-drag to bypass reporting or disable tmux mouse yourself. This fallback does not depend on OSC 52.

Agent text previews arrive through Lisp status polling (500 ms). Transient text
is capped at 16,000 characters and excluded from the journal and summary tree.
Final replies replace previews; cancelled and failed previews are labelled.

### Context inspector

Use `/context` for session-only, immutable locally prepared requests (not hidden
provider context). Up/Down selects historical calls; 1/2/3 shows raw payload,
memory provenance and events; 4/5/6 shows captured instructions, tools and turn
input. Left/Right pages; R refreshes the selected call; Esc returns to chat.
Missing snapshots/fields and metrics remain unavailable, never reconstructed
from current memory. Empty captured fields remain distinct from missing fields.
Reads are cancellable and bounded to five seconds; return preserves composer
state and history scroll. Cache percentages are not inferred.

Reply and tool context links open the exact captured invocation. Up/Down
continues across call-list pages; Ctrl+C and clipboard controls also work in
this screen. Events distinguish preparation, completed local write, provider
acknowledgement/rejection, and terminal outcome. Local write is not evidence
of provider receipt.

Large tool expressions retain a bounded preview in presentation metadata.
Expand the card to read the canonical expression in 2,000-character pages;
Left/Right changes pages and C copies the visible page. The full request
remains lossless in the journal. Existing journals are bounded when read.

# SlopChat terminal client

From the repository root, run `bun install --cwd ui`, then `./scripts/chat-tui`
or `./scripts/chat-tui /absolute/chat/directory`. Start the Lisp server first;
see [the root README](../README.org). The client connects to the selected chat's
`session.sock`.

## Controls

| Key | Action |
| --- | --- |
| Enter | Send the composer message |
| Ctrl+Enter / Ctrl+J | Insert a newline; use Ctrl+J if the terminal conflates Enter and Ctrl+Enter |
| Ctrl+G | Alternative send key |
| Tab | Switch composer/memory focus, or complete a matching slash command |
| Up / Down | Select a node while memory has focus |
| Enter / D | Zoom / read the date of the selected memory node |
| Ctrl+P | Load older history |
| Mouse wheel | Scroll |
| Ctrl+O | Toggle the memory map |
| Ctrl+C / Ctrl+Q | Close the client; the Lisp server continues |
| Ctrl+R | Retry the published view |
| Ctrl+B | Restore the initial view for this client |

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

## Publish a view

From the repository root:

```sh
bun ui/src/publish.ts
```

The publisher runs typecheck, Bun tests and headless smoke checks, bundles an
immutable view, validates its imports/API, and atomically replaces
`ui/.revisions/current.json`. Source edits alone do not activate.

Confirm activation in the running client's status row and
`ui/.revisions/activation.json`: the acknowledgement must name the published file,
the running client's PID, and status `committed`. Publication success alone does
not confirm activation.

The stable host retains its renderer, connection, history and interaction session
across view replacement. Import/API rejection keeps the old view; a synchronous
render failure restores the last committed view. Ctrl+R retries the publication;
Ctrl+B restores the initial presentation locally without changing the pointer.
Candidate modules must have no top-level side effects because imports cannot be
rolled back. Pending sends are not replayed; late acceptance uses the shared session.

Restart the client for dependency, native-renderer, host or state-schema changes,
or to release accumulated module memory. A client predating the stable host needs
one restart before live publication works. The Lisp server runs independently.
Eight revision files are retained on disk, but Bun's ESM module cache cannot be
unloaded; memory use across unlimited revisions is not bounded by disk retention.

Set `SLOPCHAT_UI_REVISIONS=/absolute/path` for both client and publisher to use an
isolated publication channel. Its pointer and acknowledgement live in that directory.

For palette changes, read [THEME.md](THEME.md). For local checks, run
`bun run --cwd ui typecheck` and `bun run --cwd ui test` from the repository root;
the publisher also runs the smoke check.

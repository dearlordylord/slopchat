;;; slopchat.el --- Implementation task for the boot agent -*- lexical-binding: t -*-

(defconst slopchat-task
  "Implement SlopChat in this repository, using docs/UNIICHAT.md (the upstream design; our product is named slopchat) by Victor Taelin
as the memory design specification. Read the entire document before changing code.

The agent architecture must preserve the full Ouro model from
.references/ouro/boot.el: one bootstrap request, one round of eval, and an agent
that writes/redefines its own continuing Lisp loop. Preserve that behavior,
not merely the presence of an eval tool. Codex is a model adapter, not the
application's agent. The adapter returns response/tool-request data; the Lisp
agent owns tool execution and continuation. The current boot.el and production
runtime must preserve this boundary when changed. The model writes the Lisp
loop; the adapter returns tool requests without executing them.

The memory component also calls models. Share the model-adapter contract between
agent calls and bounded summary jobs, with independently configurable main and
summary models. Short nodes need no model. Summary jobs do not bootstrap Ouro
agents and cannot execute tool requests. Keep their context isolated from the
user's current execution and use correction retries within the same summary
conversation. Read CONTEXT.md for the agreed meanings of these roles.
Read boot.el and tests/boot-test.el to understand the working Codex integration.
.references/ouro is a read-only reference; do not modify or copy its Git metadata.

Deliver a working headless GNU Emacs Lisp implementation, using the installed
Codex CLI app-server and its existing ChatGPT login. Do not require an OpenAI or
Anthropic API key. Keep the existing agent/agent-boot entry points working.
Do the work yourself; do not spawn subagents. Use emacs_eval to inspect, create,
and validate the implementation. The implementation may be split into focused
Lisp files rather than putting everything in boot.el. Keep generated chat data
out of Git. Do not commit or publish anything.

Required behavior:

1. Durable chat storage: daily main/YYYY-MM-DD.jsonl and tree/YYYY-MM-DD.jsonl,
   plus view.json, under a configurable chat directory. Store the specified
   message/node fields and kinds, permanent monotonically increasing ids, actual
   UTF-8 byte sizes, and timestamps. Append and flush log writes; never rewrite
   or delete log records. Hold an exclusive chat lock and reject a second writer.
   Hold a kernel flock that releases on process death. Save view.json atomically
   as a checkpoint containing the view, compaction view, contiguous log cursor,
   and pending-batch flags. Preserve existing view entries at restart and recover
   only committed leaves beyond its cursor. Save and truncate only an incomplete
   final record; never remove a complete record. Report other corruption.
   Do not resume interrupted model work automatically. A normal reopen must
   preserve node identities, summaries, order, and rendered view bytes.

2. Preserve user/reply text exactly in the log, splitting long non-tool text into
   consecutive messages at UTF-8-safe boundaries with a documented size limit.
   Clip tool output to head and tail, at most 30,000 characters of output in all.
   Log tool names and JSON inputs as tool, results as echo, replies as slopchat (accept legacy unii records when reading).
   Do not log reasoning/thoughts. Provide note import. Subagents and their work
   messages are optional and must not be launched automatically.

3. Implement the immutable aligned binary summary tree: node(0,i) summarizes
   message i; node(l,i) merges nodes(l-1,2i) and (l-1,2i+1). Use short source text
   unchanged when it fits 512 UTF-8 bytes, including directly joined short
   children when they fit. Build and append each successful node once. No
   placeholders or partial raw messages in model context.

4. Maintain a persisted oldest-first view covering every summarized message
   exactly once, with aligned power-of-two ranges rendered as id+n|summary
   inside <chat>. Flatten newlines to spaces, omit dates, and count actual
   rendered UTF-8 bytes. Append new leaf lines without rewriting older lines.
   Above 128,000 bytes enter a merge batch until at most 64,000 bytes; if parents
   are not ready, retain the pending batch and resume as nodes become available.
   Merge only adjacent siblings with a built parent. Rank by age measured from
   the pair's LAST message divided by child span, highest due first, oldest on
   ties. Use exact integer/rational comparison rather than floating-point ties.
   Do not use age from the first message, fixed K-per-level, or per-message
   merging outside the specified pending batch behavior.

5. Queue ready compactions instead of scanning the entire tree for work. A leaf
   becomes eligible when fewer than eight preceding leaves are unbuilt; a parent
   becomes eligible once both children exist. Run at most eight model calls at
   once, using separate Codex threads for parallel calls. Make summary-model and
   concurrency configurable; select a cheaper available model without assuming
   an unavailable model name. Build the contextual compaction view with the
   specified 16,000/32,000-byte sawtooth, bounded by the target range and first
   unbuilt leaf. Use the same stable system instructions and tool definitions
   for turns and compactions. Summarization calls must never execute tools.
   Follow the document's compaction prompts with the 512-dash ruler, measure
   output bytes yourself, request corrections in the same compaction thread up
   to the specified five attempts, and keep the shortest result. Allow the
   documented residual oversize after retries and measure its real size.
   Retry failed compactions at the next message without duplicate stored nodes.

6. Adapt the document's system prompt to this headless single-host application;
   omit the computer/device paragraph and unsupported subagent features.
   Preserve the instructions about zooming, data-only compaction inputs, and
   accurate summaries. Implement zoom(id,n) and date(id) as real Codex tools;
   validate alignment, power-of-two spans, and existing records. zoom(id,1)
   returns the original text with pagination for long data; larger zooms return
   the two children. Keep ordinary application context within the specified
   bounded view rather than accumulating raw zoom results across user turns.

7. Every idle user message starts a NEW Codex thread/session: previous turns
   must not survive as hidden model history. Wait for all prior messages to be
   summarized, render the view BEFORE logging the new user message, then supply
   the stable tools/system, view, and whole new message. Record all subsequent
   replies and tool events. Later input during a running turn must be logged and
   delivered between tool calls with the app-server steering mechanism. Date or
   per-turn state belongs after the view, never in stable system instructions.
   Keep a persistent app-server process if useful; distinguish process reuse
   from conversation/thread reuse. Do not remove stored chat history when
   resetting model context.

8. Provide a small usable headless entry point to open a chat directory, send a
   message, display the reply, and close cleanly. Include exact Docker/headless
   launch instructions. No web UI is needed. Keep the bootstrap implementation
   separate from the user's persisted chat store.

Codex-specific adaptation:
The document's Anthropic cache_control marks, prices, lifetimes, and Haiku model
are not Codex features. Preserve stable input prefixes and the batching design,
but do not emulate cache marks, scrape auth tokens, or claim the document's cache
hit rates/costs for Codex. State unsupported cache controls explicitly in the
implementation documentation. Reuse the app-server ChatGPT authentication and
check it; do not silently fall back to paid API-key authentication. Inspect the
installed CLI protocol/schema for dynamic tools, events, steering, and model
availability when needed. If an actual protocol limitation prevents a required
feature, make the limitation explicit with evidence rather than silently
changing the behavior.

Verification and acceptance:
- Add deterministic ERT tests with a mock summarizer/model transport, covering
  byte counting with Cyrillic/emoji, lossless splitting/reassembly, clipping,
  log durability/reopen, lock exclusion, node idempotence, zoom/date validation,
  exact range coverage, merge priority/ties, batching and delayed parents,
  compaction retries, queue scheduling, and fresh threads between user turns.
- Include the T=10 regression: from 0+4,4+4,8+1,9+1 choose the newest leaf pair,
  not the oldest 0..7 pair. Cross-check the merge order against Taelin's rollback
  push for t=0..20,000 with its list length used as a test-only budget.
- Test that short inputs need no model call, failed summaries cannot introduce
  partial context, compactions cannot execute tools, and no reasoning is logged.
- Simulate enough messages to exercise 128KB-to-64KB batches and persisted
  compaction views without spending subscription calls on a large simulation.
- Run the existing boot tests and the new tests. Then run a small real Codex
  smoke test using the existing login: two user turns, a Lisp tool call, close
  and reopen, and retrieve a prior message with zoom. Show evidence that the
  second user turn used a new thread and persisted data survived unchanged.
- Summarize implemented files, commands, test results, real-run evidence, and
  any remaining deviations. Do not declare completion while required behavior
  remains unimplemented.")

(provide 'slopchat-task)
;;; slopchat.el ends here

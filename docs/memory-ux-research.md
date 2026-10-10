# Memory-native agent UX

Research date: 2026-10-09. Proposals only; no UI implementation.

## Sources and scope

- Local design: docs/UNIICHAT.md, especially sections 2-4 and 6. This describes an adaptation of Taelin's rollback push, not a verified original Taelin article. The original article was not independently located or checked in this research.
- Anthropic: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents . Context is a finite attention budget; recommends high-signal context, just-in-time retrieval, compaction, and structured notes. Aggressive summaries can omit subtle critical details.
- Claude Code: https://code.claude.com/docs/en/how-claude-code-works . Context includes instructions, files, conversation and tool outputs. Automatic compaction and /context inspection are documented; subagents isolate their working context and return summaries.
- Official OpenAI documentation: https://developers.openai.com/api/docs/guides/conversation-state . Context-window accounting includes input, output and reasoning where applicable; persistent conversation state does not remove context limits.

Fetched and read the three official pages. Provider behavior and cache pricing in the local design are not independently validated here.

## Key distinction

The immutable journal, summary tree, current view, exact per-call input, and user-visible chat are different objects. Archive retention is not semantic recall: an omitted detail may remain in an original but become undiscoverable from its summary. Memory-view byte budgets are not model context-window token limits. Reading a node in the UI must not silently inject it into an agent request.

## Prioritized proposals

1. Exact context inspector: an immutable snapshot of the view actually sent for a call, separate from the current view. Show revisions, node coverage, bytes, measured tokens when available, system/tools/new input and retrieved content as distinct categories.
2. Memory activity rail: compact, grouped events for summarization, view publication and agent zoom. Animate only real in-progress work. Errors remain discoverable; routine merges do not flood chat.
3. Inline memory lens: expand a source-linked memory reference in chat without losing draft or scroll. Explicitly attach a reference to a future request; keep UI browsing distinct from agent retrieval.
4. Resolution timeline in /map: chronological coverage rectangles, sized by covered messages, distinguishing current-view nodes from archive-only descendants. Show node identity, time range and resolution; no arbitrary importance scores.
5. Compaction inspection: two children and their parent summary, with publication status. Describe factual changes rather than claiming semantic loss has been measured.
6. Append-only corrections with source references. Never overwrite canonical history or immutable summary nodes. Durable promotion/pinning requires a separate, bounded policy and user approval because it changes prompt construction and caching.
7. Developer diagnostics: reproduce exact input snapshots; trace zoom paths; test whether instructions, corrections, uncertain findings and completion evidence survive repeated merges. Do not display an invented confidence score.

## Suggested first increment

Exact context snapshots plus a quiet activity rail and inline source navigation. Next, enrich /map with resolution and compaction inspection. Defer semantic topic indexes, persistent pins, memory editing and thread sharing until their authority, budget and invalidation policies are specified.

## Acceptance principles

Lisp owns memory and event truth; UI derives views without duplicate authority. No hidden prompt mutations. UI browsing must not affect next-call context. Show pending/failed summary work distinctly from published view changes. Missing telemetry is unknown, not zero. Group routine activity and preserve canonical records. Immutable source links make claims auditable, not automatically correct.

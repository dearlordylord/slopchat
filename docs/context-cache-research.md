# Context and cache telemetry research

Date: 2026-10-09. Research only; no runtime changes.

## Evidence

- Official OpenAI documentation: https://developers.openai.com/codex/app-server documents `thread/tokenUsage/updated` as active-thread usage updates. The installed `codex-cli 0.161.0` generated schema confirms threadId, turnId, tokenUsage.last, tokenUsage.total and nullable modelContextWindow. Breakdowns contain inputTokens, cachedInputTokens, outputTokens, reasoningOutputTokens, totalTokens and optional cacheWriteInputTokens (schema default 0). Schema presence is not evidence that every live call emits these fields.
- Official OpenAI documentation: https://developers.openai.com/api/docs/guides/prompt-caching describes prefix reuse; maintaining a session does not guarantee a hit. This API guidance does not establish ChatGPT subscription billing or our app-server cache accounting. Do not infer hits from repeated local text, nor display API cost savings for this subscription transport.
- Pi source pinned to 42a3497d03ad17e308a2299fa824727894f2c0ec: [footer](https://github.com/badlogic/pi-mono/blob/42a3497d03ad17e308a2299fa824727894f2c0ec/packages/coding-agent/src/modes/interactive/components/footer.ts), [session](https://github.com/badlogic/pi-mono/blob/42a3497d03ad17e308a2299fa824727894f2c0ec/packages/coding-agent/src/core/agent-session.ts), [compaction](https://github.com/badlogic/pi-mono/blob/42a3497d03ad17e308a2299fa824727894f2c0ec/packages/coding-agent/src/core/compaction/compaction.ts). Footer separates cumulative input/output/cache-read/cache-write totals from latest cache hit rate. Latest rate uses cacheRead / (input + cacheRead + cacheWrite). Context usage combines last valid assistant usage and estimated trailing messages; after compaction it is unknown until a valid subsequent response. These are Pi accounting semantics, not a formula to copy to Codex.
- Local `lisp/slopchat-codex.el` forwards run-associated notifications through its event callback. `lisp/slopchat.el` currently handles only streaming text there; it does not retain usage. Finished runs are removed, so late notifications can be dropped. `lisp/slopchat-model.el` creates a fresh provider thread for each invocation and interrupts at the tool boundary. Observations may therefore be absent or partial even for successful host tool calls. No live event capture was performed.

## Design consequences

1. User-facing metrics use tokens and validated context/cache percentages, not request bytes. Byte budgets are internal retention mechanics. Provider adapters map observations into a small provider-neutral contract; neither tokens nor percentages measure recall quality.
2. Store optional raw usage observations in Lisp with local call identity, provider thread/turn identity, receipt time and source/version. Preserve last and total separately; updates replace observations, not additive deltas. Deduplicate before any aggregation.
3. Do not equate provider-thread totals with a user round, nor with whole-chat usage. A round can span many fresh threads; compaction calls must have a separate purpose and accounting scope.
4. Initially show reported input, cached input and output counts in the inspector. Defer cache percentage until the installed provider semantics establish whether cached input is included in inputTokens. Pi uses a different normalized accounting model.
5. Optional schema defaults are not observations: missing cache-write data remains unavailable, not measured zero. Zero is valid only when explicitly reported. Invalid or inconsistent counts remain diagnostic evidence, not a corrected or clamped metric.
6. Do not call totalTokens / modelContextWindow current context occupancy. A cumulative consumption counter is not a live window measurement. A future percentage needs an explicitly defined, validated numerator, matching model limit and freshness label.
7. Keep telemetry correlation alive separately from streaming runs for a bounded late-event grace period; reject wrong identities and retain terminal outcome without reopening cancelled work. Historical snapshots stay immutable while separate observations can arrive later.

## Remaining verification

A controlled opt-in live trace is needed to verify emission timing, last/total meaning, cached-input inclusion, final updates after interrupts, resolved model/limit provenance and actual account availability. It must not persist prompts or secrets. Until then raw reported counts are supportable, cache percentages and live occupancy are not. No server restart or real provider test is needed merely to finish this research.

## Isolated live experiment (2026-10-09)

An owned batch Emacs connection used the existing adapter and authentication, without changing or restarting the chat server. Two fresh-thread calls tested normal completion and interruption on an eval request; the requested eval was not executed. A dispatch-level observer recorded only elapsed receipt times, event names and usage counters. Scratch probe code was removed; both the probe and removal check exited 0.

- Normal completion: usage received at 3.516 s, turn completion at 3.519 s, then adapter return. Reported input 7319, cached input 3968, output 5, total 7324, context limit 258400.
- Tool boundary: tool request received at 9.444 s, usage at 9.446 s, then adapter return; turn completion arrived at 9.447 s during the bounded post-return pump. Reported input 7331, cached input 0, output 25, total 7356, context limit 258400. Times are relative to experiment start, not per-call latency or provider timestamps.
- Both observations explicitly reported cache-write 0 and reasoning-output 0; last and total matched for these single-turn threads. These examples do not establish multi-turn semantics or guaranteed emission. Delivery can straddle adapter return; observing only active streaming runs is insufficient for reliable terminal telemetry.
- Arithmetic is consistent with cached input being a subset of input, but does not prove that accounting contract. Do not copy Pi's denominator or label cumulative total/context-limit as live occupancy. Validate adapter semantics before enabling percentages. Cancellation, authentication failure, model changes and absent notifications remain test cases, not verified outcomes.

The experiment confirms receipt availability for this installed account/adapter in two cases, not a universal provider capability. Future Claude mapping belongs in its adapter, with the same availability and freshness semantics.

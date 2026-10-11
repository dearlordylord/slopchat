# Memory specification audit

Checkpoint: `cbb1090`. Governing contract: `docs/UNIICHAT.md`.

Status: local fixes and live activation delivered. Initial provider cache measurements and ledger reconciliation passed; the promised reuse across fresh calls is not established. The implementation must preserve Lisp authority and the lossless canonical log. The user's additional requirement is visibility into reported cache reuse and expenditure, including explicit missing telemetry.

## Contract and evidence

| Requirement | Result | Evidence / limit |
| --- | --- | --- |
| Same stable instructions and tools for turns and compactions | Passed locally | Shared provider/adapter helpers; summary prefix and tool-refusal tests. Model choice can still differ, so this does not establish cross-model cache reuse. |
| Append memory without rewriting old lines between batches | Passed locally | Serialized prefix regression includes quotes, newlines and UTF-8. The prefix stops before the closing `</chat>`: the complete closed view cannot literally prefix the next closed view. |
| Compaction context ends before a leaf, includes a merge's range, stops at contiguous built cursor | Passed locally | Crossing-parent split, empty-prefix, delayed-leaf and cursor-bound tests. No placeholder or partial source is rendered. |
| Preserve saved view, compaction view, cursor and pending batching on reopen | Passed locally | Exact rendered/checkpoint equality with pending batches, an unbuilt parent and an unbuilt later leaf; committed-tail recovery tests. |
| Main 128,000/64,000 and compaction 32,000/16,000 UTF-8 byte sawtooths | Passed locally | Existing sawtooth tests plus stalled and delayed-parent batching regressions. A pending batch may remain above its low-water mark until parents become available. |
| Shrink compaction view when main view actually merges | Fixed | Previously every pending main batch rearmed compaction batching. Now only a changed main view rearms it; delayed actual merges still rearm it. |
| Retain retry conversation, ruler/cut, at most five attempts, shortest result | Passed locally | One fresh thread per node, consecutive `turn/start` requests on that thread; retry sends only the correction because provider conversation retains original input and replies. Five-attempt/shortest and next-message failure retry tests. |
| Up to eight jobs; ready work queued; build nodes once | Passed locally | Scheduling/admission and node immutability tests. Controlled 16-message workload builds 16 leaves + 15 internal nodes, exactly 31 model calls; repeated scheduling adds none. |
| Count expenditure once across provider reports and retries | Fixed for new standard summary jobs | Shared per-job cumulative thread state uses normalized `tokenUsage.total` high-water marks, not a replacement of `last` for a whole attempt. Multiple increments, duplicate snapshots and older late reports are tested. |
| Route late usage to the correct attempt | Fixed | Late routes use `(thread ID, turn ID)`; completing a retry no longer retires the preceding turn's route. Retention remains 30 seconds / 100 routes. |
| Expose cache and expenditure evidence | Delivered locally | Per-attempt compaction snapshots, node/range provenance, prior retry exchanges, submission/outcome events and raw/normalized usage. Inspector labels compaction/attempt and shows latest increment, thread totals and session memory-work totals with reporting coverage. |
| Demonstrate actual summary-model cache savings | Partial; cross-thread gap observed | Post-activation sample: 2 leaf nodes / 4 attempts on `gpt-6-luna`. First attempts reused about 11%; same-thread retries reused 94–96%. This does not establish steady-state design savings. |

## Accounting semantics and visibility

New standard summaries share one cumulative state across a node's retry thread. Each reported input, output, cached-input and cache-write-input counter is added only when its absolute thread value exceeds its previous high-water mark. This includes multiple provider increments within one attempt and prevents cumulative retry totals being added twice. Coverage counts attempts with an explicit cumulative counter, not exact per-attempt attribution. A later cumulative report may include work from earlier attempts whose own reports are missing; incomplete reporting remains visible.

The inspector preserves `last`, `total`, the raw provider payload, source and timestamp. `last` is displayed as a reported latest increment; it is not assumed to be total spend for the attempt. Standard jobs without cumulative telemetry remain unavailable for cumulative accounting. The legacy metadata path still supports replacement of `last` for existing callers; do not treat pre-activation session totals as corrected historical expenditure.

OpenAI's [App Server documentation](https://learn.chatgpt.com/docs/app-server) identifies `thread/tokenUsage/updated` as the usage stream. The upstream protocol implementation inspected during the audit adds each latest usage increment into its cumulative total; this distinction motivated using absolute thread counters. These counters are reported token telemetry, not independently audited billing.

Cache sums and coverage live outside the existing ledger struct to preserve live ledger identities. Snapshots use existing bounded session retention (100 terminal entries / 32 MiB), separate from canonical memory. Late accounting survives snapshot eviction within the routing window. Custom `slopchat-summary-function` backends bypass production provider accounting.

The UI shows explicit `unavailable` when no counter was reported, distinguishes that from zero, and exposes coverage for each cumulative counter. It does not invent dollar costs, cache percentages or which exact memory node the provider cached. Provider cached-input counts show reused tokens, not the exact cached bytes or node boundaries. Anthropic cache marks, pricing and lifetime assumptions cannot be transferred to Codex subscription transport.

## Why summary work grows quickly

The binary tree contains leaves and internal nodes. When their sources exceed 512 UTF-8 bytes, both require model calls. In the isolated regression, 16 messages of 600 bytes with 300-byte summaries produce 31 calls. Sources that already fit bypass the model. Oversize replies can multiply attempts by up to five per node; failures can retry on a later logged message. This is permitted work under the contract, not evidence of duplicate node construction.

The batching defect rewrote compaction context unnecessarily and could reduce prefix reuse; it does not itself create new summary nodes. The historical burst of attempts 154 to 160 demonstrated actual new attempts, but its exact mix of leaves, parents, oversize retries and failures cannot be reconstructed from the old ledger. New snapshots provide node IDs, attempt numbers and prior exchanges for that diagnosis.

## Read-only live observations

On 2026-10-10, requests through `.chats/main/session.sock` returned count/cursor 6908, zero active/failed summaries, and the old ledger's 1,104 attempts, 17,377,476 input and 123,906 output tokens. These are old accounting observations, not corrected or billed totals.

The latest retained ordinary-call snapshot reported input 39,355, cached input 36,864, output 77 and cache-write input 0. This establishes reported reuse for that ordinary call only. It is not a summary-model measurement or proof of the specification's 98.6% / 96.2% simulation claims. Memory was read through status/view and `zoom`; no canonical files were rewritten.

## Validation

Final combined ERT: **119/119 passed**, zero unexpected, 2026-10-10 22:32:40-0400; log `/tmp/memory-activation-ert.log`. A subsequent provenance-only change (thread/model labels) passed the focused compaction snapshot regression. Isolated batch Emacs instances and temporary chats only.

UI: **48 tests passed**, zero failed, **193 assertions**, across 19 files; log `/tmp/memory-activation-ui.log`. `bun run --cwd ui typecheck` passed. `git diff --check` passed.

Reproduce:

```sh
emacs --batch -Q -L lisp \
  -l tests/boot-test.el -l tests/slopchat-test.el \
  -l tests/slopchat-ui-test.el -l tests/slopchat-accept-test.el \
  -l tests/slopchat-process-test.el -l tests/slopchat-failure-test.el \
  -l tests/slopchat-context-test.el -l tests/slopchat-memory-usage-test.el \
  -f ert-run-tests-batch-and-exit
bun run --cwd ui typecheck
bun run --cwd ui test
git diff --check
```

## Authorized live activation and measurements

The user explicitly instructed the assistant to perform activation. On 2026-10-11 at 02:34:19 UTC, the loader activated the six changed Lisp modules in existing server PID **3408388**, after the requesting round, summary jobs and old late routes finished. It preserved the agent function, main/compaction rendered views and count/cursor **6912**. The active TUI PID **2480392** acknowledged the view replacement with `status: committed`. Neither process was restarted.

The activation script passed an isolated temporary-chat check before use. Result: `/tmp/slopchat-memory-activation-result.el`. A fresh cumulative-accounting period started at activation; the legacy ledger is preserved and displayed separately, rather than mixing old `last` accounting with new thread totals. Legacy totals at activation: 1,128 attempts, input 17,775,344, output 127,211. Source/model/request provenance is available for new summary calls.

Live verification used one maintenance message and a note recording its actual outcome through normal socket actions. Those actions appended normal records; the loader did not edit/rebuild canonical logs or views. No isolated provider replay or additional agent was spawned.

Evidence: [`memory-live-observations.json`](memory-live-observations.json). Selection: most recent 20 retained calls at 2026-10-11 02:36:12 UTC, filtered to post-activation compaction snapshots. This yielded **four attempts on two leaf nodes**, all on `gpt-6-luna`:

| Node | Attempt | Latest input | Latest cached input | Latest output |
| --- | --- | --- | --- | --- |
| 6912+1 | 1 | 16,329 | 1,792 | 32 |
| 6914+1 | 1 | 16,434 | 1,792 | 185 |
| 6914+1 | 2 | 16,841 | 16,128 | 170 |
| 6914+1 | 3 | 17,229 | 16,128 | 153 |

For this sample, sum of per-thread cumulative maxima exactly matches the live ledger: **66,833 input, 35,840 cached input, 540 output, reported cache-write input 0**, with **4/4** reporting coverage for every counter. Summing each attempt's cumulative `total` would double-count retries; reconciliation used one maximum per thread. A reported cache-write zero remains provider telemetry, not proof that no cache entry was written.

Both fresh-thread first attempts reused about **11%** of reported input. The subsequent retries reused about **96%** and **94%**. These denominators are complete reported input, not the design document's reusable-prefix denominator. The two-node sample proves that new snapshots, retry history, live counters and ledger reconciliation work. It does **not** prove the target steady-state savings, and suggests a cross-thread reuse gap that needs further diagnosis.

OpenAI's [prompt caching documentation](https://developers.openai.com/api/docs/guides/prompt-caching) distinguishes stable prefix reuse from cache-accounting keys and provider routing. Local prepared request snapshots do not expose the final internal provider request, so changing cache keys or blaming one transport field from these measurements would be speculative.

## Remaining cache-economy investigation

Activation is complete. The remaining acceptance gap is explaining and improving reuse between **fresh** compaction threads while preserving the fresh-session contract. Inspect provider prefix/routing behavior and any supported cache controls; do not retain one conversation across separate nodes merely to improve cache statistics. Keep measuring actual provider reports. The current small sample, especially warm same-thread retries, must not be presented as achievement of the design's 96.2% claim or dollar savings.

## Direct diagnosis through Codex Autoresearch

The user invoked `codex-autoresearch` to establish the cause. Its read-only `prompt-plan` returned `continue-direct`, `assist-only`, session relation `none`: a request to diagnose a cause does not itself authorize a repeated optimization loop. No Autoresearch session, budget, packets or commits were created. No new model calls or live code changes were made in this diagnostic step.

### Evidence separating prompt churn from routing

The two saved first-attempt snapshots, suffixes `:636` and `:638`, were read through the existing paginated context API. Their captured instructions and tools are exactly equal. Their serialized inputs share **27,193 UTF-8 bytes**. After decoding the Lisp conversation, the views share **26,808 UTF-8 bytes / 26,079 characters**; the old view has 26,086 characters, so divergence occurs at its seven-character closing `</chat>`. The later view adds node `6912+1` there. This rules out a rewritten local memory prefix for this pair. It does not independently reveal the final internal provider input or its tokenizer.

Running transport PID **3520478** reports `codex-cli 0.162.1`; its executable hash matches the installed distribution. The corresponding pinned upstream source shows:

- [`client.rs`, `prompt_cache_key` and `responses_session_id`](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/core/src/client.rs#L581): ordinary sessions default the cache key to their session ID. The source explicitly identifies the Responses session-id header as the ChatGPT cache-affinity input.
- [`session/session.rs`, session initialization](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/core/src/session/session.rs#L931): a new root session uses its own thread ID as session ID.
- SlopChat's `slopchat-codex-thread` calls `thread/start` for each node, supplying neither an inherited cache route nor a cache-key override. The sampled nodes have different thread IDs. Retry turns retain the same thread.

Therefore the implementation demonstrably changes cache-affinity identity between fresh nodes, but preserves it across retries. This mechanism agrees with the observed approximately 11% fresh-call reuse versus 94–96% retry reuse. The former local assumption that a matching memory prefix alone should secure cross-thread reuse was incomplete. Backend routing is the leading explanation; its exclusive causal effect and the improvement from changing it remain unmeasured.

### Supported candidate, not an accepted fix

The same pinned session source has a deliberately separate path for **ephemeral forks**: it reuses the source's session ID as a cache-routing override while giving the fork its own identity. See [fork cache key initialization](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/core/src/session/session.rs#L901) and [override application](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/core/src/session/session.rs#L1793).

A candidate is to fork each call from a never-used, empty anchor thread, preserving a shared cache route without carrying any previous model conversation. This needs independent checks that the source has no turns, forks inherit no user/assistant/tool messages, tool definitions stay correct, thread lifecycle remains bounded, and prepared snapshots retain exact provenance. Availability for an empty/ephemeral anchor is not established merely by the source comment. Do not fork an ordinary used thread or silently retain previous node conversations.

A causal confirmation would compare fresh `thread/start` against independently fresh calls with a shared supported cache route, on the same fixed context/model, with repeated measurements and unchanged controls. Under the invoked skill that is a separate measured-loop contract: explicit model-call/execution budgets, evaluator and independent checks, editable/protected scope and stop rule must be accepted before launching it. No such loop has been authorized or executed. This diagnosis makes no measured-improvement claim.

## Empty-anchor candidate protocol check

The user authorized trying the cache-routing candidate. An isolated Codex 0.162.1 transport tested both an ephemeral empty anchor and a persistent empty anchor, without `turn/start` or model inference. In both cases `thread/fork` returned `no rollout found for thread id`. A separate persistent-anchor history read returned `list_turns is not supported yet`; this was removed from the final fork probe so it did not mask the fork result. Owned persistent anchors were submitted for archival and the isolated transport was closed. The live server and canonical chat were not changed.

Consequently B is not currently a working alternative: the installed protocol cannot fork these never-used empty anchors. Do not seed an anchor with a model conversation and silently inherit that history; the specification requires independent fresh summary contexts. The pinned source's ephemeral-fork routing behavior alone does not establish a usable empty-anchor API path.

Proposed controlled comparison, once a compliant B exists: A creates each independent summary with `thread/start`; B creates each with the same empty-anchor cache route and independent identity. Hold model, instructions, tools and serialized input fixed; compare first attempts only, excluding correction retries, with balanced/interleaved order. Record input, cached input, uncached input and output separately, plus request provenance and reporting coverage. Verify empty histories and identical effective inputs independently. Provider token usage is not a billed-dollar measurement. No A/B model calls or measured improvement occurred in this protocol check.

## Metadata-only rollout follow-up

The user removed the requirement to preserve the running server process; restarts are now permitted when necessary. Preserve canonical memory and preexisting changes.

A follow-up isolated protocol probe succeeded using `thread/fork` with an explicit path to an owned metadata-only JSONL rollout. Its single `session_meta` entry contained no turn, message or response history. Two ephemeral forks returned distinct thread IDs and explicit empty `turns: []`; the request trace contained only `thread/fork` and `thread/unsubscribe`, with zero model calls. This supersedes the broader conclusion that no empty-anchor candidate can be created: forking an unmaterialized started thread failed, whereas loading a metadata-only rollout by path worked.

This is protocol feasibility evidence only. The probe inherited the default model (`gpt-6.1-sol`), not the target summary model; it did not include the production dynamic tools or measure cache usage. Before integration, pin `gpt-6-luna`, preserve production instructions/tools, test serialization and independent contexts, and verify actual cache-route behavior. No binary patch is currently needed. The candidate is not accepted as a measured improvement.

## Configured empty-fork preparation

A second metadata-only rollout probe explicitly pinned `gpt-6-luna`, OpenAI provider, approval/sandbox settings and cwd, and added the production eval dynamic-tool definitions to session metadata. Both ephemeral forks returned the requested model, distinct IDs and explicit empty histories. No `turn/start` was issued. This verifies protocol construction and model selection; effective dynamic-tool availability and cache performance still require execution evidence.

The active user goal now explicitly requests a bounded A/B and an evidence-backed adopt/reject decision. A proposed contract is awaiting acceptance: 60 minutes maximum, eight model calls (four A and four B), identical inputs/instructions/tools, interleaved order, first attempts only, independent empty-history/correct-summary/usage checks, and at least 20% lower mean uncached input before adoption. These are proposed conditions, not an accepted budget or measured result. Canonical memory remains protected and no commits are authorized.

## Isolated candidate module

`lisp/slopchat-cache-candidate.el` now implements owned metadata-only anchors and independent ephemeral forks, but production does not load or select it. It rejects missing/nonempty histories, reused identities and model mismatch before a turn can start, and removes owned anchor files on close. Anchor files use mode 0600 and contain only one session-metadata record with stable instructions/tools.

Two focused ERT checks passed, covering metadata contents/cleanup and fail-closed history/identity/model validation. An isolated installed-Codex smoke using this module produced two independent empty forks on `gpt-6-luna`, with zero model calls; see `docs/memory-cache-candidate-probe.json`. No canonical chat modification or server restart was needed. Actual tool availability during inference, provider cache accounting and the adopt/reject comparison remain unverified. A/B contract acceptance is still pending.

Anchor integrity follow-up: candidate pins SHA-256 at creation and rejects changed or symlinked files before RPC. A regression appends a response-history record and verifies no submission occurs. Focused ERT now passes 3/3; the updated module's zero-inference installed-Codex smoke still yields two independent empty forks on gpt-6-luna. This remains preparation, not A/B cache evidence.

## Final bounded A/B decision

The user accepted the full contract and 60 minutes. Eight actual calls completed across AB1 and AB2, with no history transfer or tool execution. A/B totals and per-call evidence are in `docs/memory-cache-affinity-ab.md` and `.json`. Mean uncached input: A 25,665; B 8,273. Reject the current candidate for production: effective provider context/tool parity is unproven, and input totals differ consistently by 2,096 tokens despite identical local paired input. The observed 67.8% lower uncached mean is descriptive, not causal or production savings proof. Production remains on thread/start. All earlier statements that no A/B occurred are historical and superseded by this result. No commits or branch creation; isolated detached checkout used, existing canonical memory preserved.

## Corrected runtime and actual cache solution

The old A/B rejection was followed by source diagnosis and a concrete fix: explicit model runtime metadata prevents legacy fork tools. The corrected implementation is enabled and loaded into the existing server. It preserves independent summary histories and ledger identity; subsequent independent real streams report ~95.6–96.0% cached input on their first attempt after initial warm-up. See `memory-cache-solution.md` for alternative analysis and limits, and `memory-cache-live-routing.json` for exact reported usage and reconciliation. This supersedes the old candidate rejection, without rewriting its original observations.

## Follow-up audit: 2026-10-11

Isolated combined ERT including cache-candidate tests passed 126/126, zero unexpected, at 00:06:00-0400. Log: `/tmp/memory-followup-ert.log`. This reruns prefix/reopen, retry accounting and cache-routing regressions without restarting or reloading the live server.

A read-only live observation found 35 reported empty-fork first attempts: 585,601 input and 466,176 cached input (79.61% aggregate reuse). This is a changing production workload, not a controlled comparison or a guarantee of the design percentage. Earlier warm-stream rates near 96% must not be generalized to all calls.

One cumulative maximum per retained summary thread gave 38 threads, 1,389,777 input, 1,163,264 cached input and 10,694 output. At the same observation the session ledger reported 1,406,106 input, 1,165,056 cached input and 10,726 output; coverage 85/86 attempts. The difference is exactly 16,329 input, 1,792 cached input and 32 output: the previously recorded first post-activation leaf snapshot `:636`, now absent from retained snapshots. Adding that recorded observation reconciles all three counters exactly. Snapshot retention and lifetime accounting have different scopes; missing current telemetry is not zero. Legacy totals were preserved separately.

No extra inference experiment, agent, restart, commit or canonical-memory rewrite was performed. Cached node boundaries and billed cost remain unavailable. Local contract regressions pass and observed accounting reconciles; steady-state cache-economy acceptance remains limited by workload-dependent hit rates.

## Retention and reopen verification: 2026-10-11

Combined isolated ERT passed 127/127, zero unexpected, at 00:59:26-0400; log `/tmp/memory-current-audit-ert.log`. Added `slopchat-reopen-preserves-decision-correction-and-zoom`: a temporary chat preserves an original decision, an explicit path correction, a restriction and an open task across close/open. Rendered view and serialized provider input are exactly equal before and after reopen; zoom returns both original messages exactly. Existing delayed-parent/pending-batch, retry-accounting and cache-routing regressions also pass.

This establishes local storage and request-prefix fidelity, not semantic quality of model-generated summaries: the new short fixtures bypass inference. No new provider calls were made. Summary quality across repeated compression remains open and must not be marked accepted on the strength of these tests. Inspection also confirms that five oversized replies retain the shortest even if it exceeds 512 bytes (the existing regression expects 521 bytes); the nominal size limit is therefore not an unconditional invariant. The governing contract explicitly permits this after five attempts (UNIICHAT.md, retry section: A few bytes over is fine); this is not a deviation and must not be fixed by truncating facts.

No server restart/reload, additional agent, commit, canonical-memory rewrite or reference edit.


### 2026-10-11 controlled summary-retention smoke

Isolated batch Emacs, temporary chat, production gpt-6-luna summary path; logs: /tmp/slopchat-quality-audit.log, fixture: /tmp/slopchat-quality-audit.el. Process process-2173 exited 0. Four long synthetic user messages exercised leaf and parent model compression through node (2 0). Final summary preserved RET-42, corrected /tmp/retention-final.json superseding /tmp/retention-fixture.json, budget 1700, pagination open, no restart/commit, Lisp authority, canonical memory/ledger, .references restriction, /tmp/retention-report.md, sections 4/5 passed, section 6 E_RET_6, fix/rerun and incomplete acceptance. Reopen rendered identically. This is one synthetic smoke, not a general quality score.

Observed attribution defect: leaves (0 2) and (0 3) incorporated prior-context facts absent from their own source input, tagging them user. The compaction instruction explicitly forbids adding context-only facts to input summaries. Parent retention passed, but leaf source fidelity did not; do not close the quality audit. Next: regression for context-only fact leakage and adjust compaction prompt, then repeat this fixture and an unrelated-topic fixture. Main chat/server were not modified or restarted; only the isolated test transport was closed.


### Source-fidelity prompt correction

Added a task-local instruction to slopchat--compaction-task: summarize only input facts; context may resolve references but must not supply unrelated facts attributed to input. This does not change shared provider instructions or cache-anchor identity. Isolated production-path repeat (process-2192, exit 0; /tmp/slopchat-quality-audit-after.log) preserved the final decision, restrictions, exact paths, ticket, budget, failure and pending work through node (2 0); leaves (0 2)/(0 3) no longer copied the unrelated prior facts observed in the first run. Reopen remained identical. Full isolated ERT passed 127/127 (process-2198; /tmp/memory-quality-ert.log). One before/after synthetic fixture is limited evidence, not a guarantee of summary quality. An unrelated-topic fixture and repeated source-fidelity checks remain open. Prompt edit is on disk only, not loaded into the live server; canonical memory unchanged.

### Source-fidelity follow-up: 2026-10-11

Added slopchat-compaction-source-fidelity-instruction, covering leaf and parent task instructions and exact input boundaries. This is a prompt-contract regression, not a deterministic semantic model-quality test. Combined isolated ERT passed 128/128 (process-2290; /tmp/memory-fidelity-final.log).

Two independent production-model runs of /tmp/slopchat-quality-unrelated.el completed successfully (process-2284 and process-2287). Logs: /tmp/slopchat-quality-unrelated.log and /tmp/slopchat-quality-unrelated-repeat.log. All four leaves stayed on their own topic; no unrelated orchard facts appeared in telescope or recipe leaves. Exact paths, budget, pending work, correction, failure E_SKY_6 and incomplete acceptance survived. Reopen was identical in both runs. The second run compressed the root with inference; the first root fit without further inference. These small synthetic samples do not establish general quality or a leakage-rate bound.

The task-local prompt correction remains on disk pending narrow live activation. No restart, agent, commit, reference edit or canonical-memory rewrite.

Narrow live activation completed: evaluated only the validated slopchat--compaction-task definition from disk; host returned :compaction-prompt-activated. Existing jobs retain already prepared requests; newly prepared tasks use the source-fidelity instruction. No full-file reload, server restart, canonical-memory rewrite or ledger reset.

## Live summary spot check, 2026-10-11

Read-only inspection of completed live nodes after source-fidelity activation found two concrete distortions. Node (3 896), range 7168+8, changes the author of the synthetic-check report from slopchat to echo. Node (2 1796), range 7184+4, says a compaction query returned no entries, although original message 7185 contains multiple entries (some summaries were still nil). Leaf (0 7185) instead summarizes an embedded context sample and drops the outer query result. Other inspected nodes retained reported token counters and pending audit work. This is a bounded spot check, not a general quality guarantee; corrections and mixed-topic quality are not fully covered. Canonical nodes were not rewritten, and no restart, reload, or provider calls were initiated by this check. Follow-up: regressions for nested quoted payloads, author attribution, and absent results versus empty results.


### Nested-result and author correction, 2026-10-11

Task-local compaction instructions now preserve authoritative source author labels, distinguish quoted/nested payloads from outer results, exclude compaction instructions from source facts, and distinguish missing/pending results from explicitly empty collections. Added slopchat-compaction-nested-result-instructions (prompt-contract regression, not a semantic guarantee). Combined isolated ERT passed 129/129; log /tmp/memory-nested-final-ert.log.

Production-model fixture /tmp/slopchat-quality-nested.el exposed request-instruction leakage and a tool-to-user attribution error during intermediate runs; both prompted further corrections. Initial run failed with Connection closed, not a quality pass. Final run /tmp/slopchat-quality-nested-author.log preserved all four leaf authors, two entries with nil/pending summaries, an absent query result, and a separate explicitly empty query; reopen identical. This remains a small synthetic sample, not proof of general fidelity.

Narrow live activation returned :compaction-prompt-activated: evaluated only slopchat--compaction-task. Newly prepared tasks use the correction; existing prepared jobs and historical canonical summaries are unchanged. No restart, full reload, agents, commit, reference edits, canonical-memory rewrite, or ledger reset.


### Post-activation live fidelity check, 2026-10-11

Read-only comparison of ten completed nodes selected from session compaction provenance whose prepared prompt contains the author-label rule found residual failures. Node (0 7261) says the supplied query result is not included, although its source is a nonempty list of six records, including completed summaries and two pending summaries. It drops that outer result in favor of embedded historical audit facts. Nodes (0 7258) and (0 7259) convert a quoted historical tool request returned by zoom into an assertion that documentation was added; (0 7259) also replaces the outer echo author with tool. Node (1 3629) propagates these leaf distortions rather than repairing them. Node (3 906) says zoom requested compaction records, although zoom returned the text of a historical eval request. Nodes (4 452) and (3 905) preserve the main activation, test, limitation, and user-request facts, with some compression of detail. Other inspected nodes preserve the supplied prior findings or the absence of a result in a tool-request-only source.

Conclusion: the activated prompt does not reliably distinguish nested historical requests from current results. This is a bounded live spot check, not an estimated error rate. No additional tests or provider calls were initiated; no code changes, canonical-node rewrites, restart, activation, commit, reference edits, or ledger reset were performed. Follow-up requires a regression using the actual nonempty nested-result shape and explicit outer-event versus quoted-event attribution; prior synthetic passes are not acceptance of this case.


### Recorded summary-boundary failures repaired — 2026-10-11

The residual live failures are now covered by exact source/failure fixtures and source-boundary validation, rather than prompt wording alone. Typed outer-event metadata and required leaf prefixes preserve echo authorship, quoted historical requests, nonempty results and unavailable summaries; parent guards retain separate authors, unestablished execution and unknown clipped-result totals. Reader-constructor syntax is rejected before parsing. Tool-denial reports are inference failures, not source facts; they retry as data-only summaries within the same cap. A live all-authors false rejection was corrected to allow omitted acknowledgements, and the blocked node recovered normally. Nil summaries are unavailable, without asserting an active pending job. Rejected answers, raw responses and normalization are observable in request events and counted in the existing usage ledger; they cannot become canonical nodes or shortest candidates. Retries share the existing five-attempt cap, with visible failure on exhaustion.

Full isolated ERT passed 149/149; TypeScript and Bun passed (52 tests, 207 assertions). Production-model replay retained six records/two unavailable summaries, quoted request 7242, clipped-result uncertainty, empty/missing distinctions and parent attribution; reopen was identical. Retention and unrelated-topic smokes also passed. Final supplemental guards were checked against retained production responses offline, not counted as another trial. See `docs/memory-summary-fidelity.md` and its linked fixtures/evidence for reproduction and limits.

Narrow activation kept server PID 3408388, ledger identity, both views, agent and shared instructions/tools. Existing nodes are immutable; correction notes 7279 and 7288 were appended normally to supersede the identified false historical claims. No historical rewrite, restart or ledger reset. The recorded regressions are closed; arbitrary long-run semantic fidelity is not proven.

## Multilevel retention audit, 2026-10-11

An isolated temporary chat with 16 synthetic messages was summarized by gpt-6-luna through root (4 0). The inspected root retained RETAIN_42, budget 2300, the explicit correction from /tmp/retain-old.csv to /tmp/retain-final.csv, E_RETAIN_6, unverified pagination, open acceptance, and no-restart/no-canonical-rewrite restrictions. Unrelated topic identifiers were grouped into ranges rather than confused with RETAIN_42. Historical and corrected paths both remain, with the correction explicitly labeled.

Zoom traversals across four levels returned both children; paginated originals at IDs 0, 7, and 15 reconstructed exactly. Reopen preserved the rendered view and root verbatim. Process-2702 exited 0; evidence: /tmp/slopchat-quality-multilevel.el and /tmp/slopchat-quality-multilevel.log. This is one synthetic run, not a general semantic-fidelity guarantee or a production-sized 64–128 KB batching test. No server restart, activation, canonical-memory edits, or ledger reset.

## Memory module extraction — 2026-10-11

The accepted interface is implemented in the independent four-file `memory` module. The application chat now owns only a memory handle and its host turn/transport/agent state; production callers and UI use public memory operations. Codex conversations/cache routing and application source-fidelity policy are separate adapters. `memory-observe` keeps turn and compaction snapshots in one bounded pool without exposing its structures or charging turn usage to compaction totals.

The contract and reproduction commands are in `docs/memory-module.org`; the requirement evidence is in `docs/memory-module-evidence.json`. Source and compiled ERT passed 173/173, byte compilation had no warnings, and UI/typecheck passed (52 tests / 207 assertions). A copied four-file package ran without loading the application. An isolated real socket server verified durable acceptance, history/zoom, attempt inspection, unknown cache and shutdown.

The comparison to committed store `26880f3` matched all views after 1024 appends and all 2047 nodes, crossed five main and 24 compaction batch drops at the actual default budgets, and reopened identically. The isolated production replay passed six leaves/four parents and reopen; its own ledger reports 20 attempts, 232,910 input, 180,224 cached input and 2,443 output with 20/20 coverage. Subsequent diagnostic result attachment and optional presentation-policy changes are covered by deterministic regressions; these are not additional provider trials.

The pre-extraction main server PID 3408388 was neither restarted nor hot-reloaded into the new struct layout. Its read-only final status was count/cursor 7345, idle, zero active/failed summaries. Fresh application processes use the new module. Canonical main records/views and live session ledger were not rewritten/reset by this extraction. Existing multilevel-retention notes were preserved. Publication of a separate repository/package remains a future action.

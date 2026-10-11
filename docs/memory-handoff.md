# Memory specification audit: current handoff

## Status

The local audit fixes and live activation are finished and verified. Fresh-summary cache routing is now fixed and activated: metadata-only anchors explicitly retain the model runtime, while each summary gets an independent empty thread. Detailed requirement/evidence matrix, accounting semantics and reproduction commands: `docs/memory-audit.md`.

`docs/UNIICHAT.md` remains the governing contract. The user additionally requested as much memory visibility as possible: reported cache reuse and expenditure, with missing observations explicit. The user authorized reading existing memory; this was done through the local read-only status/view and zoom interface.

## Delivered

- Shared provider instructions, tools and Lisp serialization for ordinary calls and compactions; summary tools remain denied.
- Regression evidence for context boundaries, serialized append-only prefix, saved main/compaction view and batching/cursor restoration with delayed nodes.
- Compaction batching now rearms on an actual main-view merge, including delayed merges, rather than repeatedly while a stalled main batch remains pending.
- Retry conversation verified: one thread per node, original input and replies retained, correction-only follow-up turns, five-attempt maximum, shortest result kept.
- Late usage routing keyed by thread and turn, preserving earlier retry routes.
- New standard summary accounting uses cumulative thread input/output/cache high-water marks, including multiple increments per attempt. Duplicate and older reports do not add spend again.
- Compaction request snapshots expose node, memory-prefix provenance, attempt number, prior retry exchanges, submission events, outcomes and usage.
- Inspector displays compaction/attempt identity, latest reported counters, thread totals, cumulative memory-work cache/input/output totals and per-counter reporting coverage. Missing counters remain `unavailable`.
- Controlled workload proves 16 long messages can require 31 model calls for their complete binary tree, and rescheduling built nodes adds no calls.

## Verification

- Combined ERT **119/119**, zero unexpected, 2026-10-10 22:32:40-0400; `/tmp/memory-activation-ert.log`. Subsequent thread/model provenance labels passed the focused snapshot regression.
- UI **48 tests / 193 assertions**, zero failures; `/tmp/memory-activation-ui.log`.
- UI TypeScript check and `git diff --check` passed.
- Live loader preserved main/compaction views and count/cursor at activation; server/TUI PIDs unchanged. Four summary attempts reconciled exactly with cumulative ledger totals.

## Constraints still in force

- Preserve Lisp authority, canonical memory and existing UI/protocol behavior.
- Do not restart/stop the server, rewrite `.chats/main`, touch `.references`, spawn agents or commit without a new explicit request.
- Do not recreate `docs/TUI-LIVE-UPDATE.md`.
- Code, comments, tests, UI labels and documentation remain English.
- Preserve unrelated/untracked artifacts and backup files.
- Changes are loaded into the live server and active TUI, explicitly authorized by the user in the subsequent activation request.

Rollback checkpoint remains `cbb1090`. Do not roll back or discard existing changes without authorization. Applicable parent/root/directory `AGENTS.md` files were not found during this run.

## Live activation and next work

Activation completed at 2026-10-11 02:34:19 UTC. Server PID 3408388 and TUI PID 2480392 were preserved. The loader waited for idle jobs and expiration of old usage routes, preserved the agent function and both views, and verified count/cursor 6912 unchanged by loading. A new accounting epoch started; legacy totals remain displayed separately: 1,128 attempts, input 17,775,344 and output 127,211.

Live evidence: `docs/memory-live-observations.json`. Four attempts / two leaf nodes on `gpt-6-luna` reconciled to **66,833 input, 35,840 cached input, 540 output, reported cache-write input 0**, with 4/4 reporting coverage. At the final observation count/cursor were 6915 and active/failed summaries were zero. Maintenance verification records were appended through normal socket actions; no old log records were rewritten.

The fresh-thread first attempts reused about **11%** of full reported input; same-thread retries reused **94–96%**. Visibility and accounting work, but the promised fresh-call cache economy remains unresolved. These full-input denominators differ from the design simulation's prefix denominator; do not claim its percentages were achieved.

Next: diagnose supported provider prefix/cache-routing controls for fresh threads, with actual reported evidence. Do not violate the fresh-session contract by retaining conversations across separate nodes. Do not reset or reinterpret legacy totals. Exact cached node boundaries and billed dollar cost remain unavailable. No controlled isolated provider replay or additional agent has been started.

## Diagnosis update

Codex Autoresearch routed cause-finding to direct evidence (`continue-direct`), without session state or new inference. The saved first-attempt inputs share 27,193 UTF-8 bytes; instructions/tools match exactly, and decoded memory views diverge only at the previous closing tag where new nodes append.

The running Codex transport is confirmed as 0.162.1. Pinned source shows ordinary root sessions use their own thread/session ID for the prompt-cache key and ChatGPT cache-affinity header. SlopChat creates a new such ID per node; retries keep one ID. This is a demonstrated routing difference and the leading explanation for the measured fresh/retry gap, not an A/B-confirmed exclusive cause.

The upstream ephemeral-fork path intentionally reuses the source cache route without reusing its lifecycle identity. An empty, never-used anchor is a possible compliant approach, subject to proving no conversational history is inherited and confirming the protocol supports it. No implementation or provider experiment was made. See the audit's pinned source links and candidate checks. A repeated causal/improvement experiment requires an accepted explicit budget and full experiment contract under the invoked skill.

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

## Cache solution activated (supersedes old candidate rejection)

The missing `multi_agent_version` field made the old fork restore Codex's legacy V1 tool surface instead of the model's V2 runtime. Correcting this metadata removed the 2,096-token fixture difference: unchanged input/instruction hashes produced exactly 35,201 input, 34,560 cached input and a correct summary.

The corrected path is now used by production summaries. One anchor is shared only across matching instructions/tools/directory/model/runtime/connection configuration; every new summary has a distinct explicitly empty thread. Inspector snapshots capture the actual fork, anchor runtime/hash/identity and tools; fallback reason is preserved if native start is needed. Closing the connection removes owned anchor files. Main model turns retain their existing creation path.

Live PID 3408388 activation preserved count/cursor 6919, both views and ledger identity. Four different real summary streams used one anchor. First-attempt cache rates: 16.86%, 95.98%, 95.83%, 95.57%. This is cross-thread reuse, not retry reuse. Four streams / 14 attempts (including normal corrections) reconciled to 240,583 input, 214,528 cached input, 26,055 uncached input and 1,720 output, coverage 14/14; active/failed summaries ended at zero. The factual maintenance note was appended via normal protocol; existing records were untouched.

Full solution/alternatives/evidence: `docs/memory-cache-solution.md`, `docs/memory-cache-runtime-fix-smoke.json`, `docs/memory-cache-live-routing.json`. Combined relevant ERT 105/105; final focused cache tests 7/7; diff check passed. Original A/B evidence remains frozen and describes the old runtime-incomplete candidate. No new governed loop or production-savings guarantee is claimed. Remaining visibility limits: exact cached node boundaries and billed dollar cost are unavailable. No restart or commits.

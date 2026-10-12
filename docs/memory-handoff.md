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

## Public package extraction (2026-10-11)

The core now lives at https://github.com/dearlordylord/unii-memory and is loaded
directly from the `vendor/unii-memory` Git submodule. Public symbols and features
use `unii-memory-`; the durable storage format is unchanged. Application prompts
and Codex adapters remain in SlopChat. The package's original implementation is
MIT licensed; upstream UNII text is linked and is not bundled or relicensed.
Initialize clones with `git submodule update --init --recursive`. Edit library
sources in place, test with a fresh Emacs process, push the library commit, then
commit the updated submodule pointer in SlopChat. The main server was not restarted.
Validation: 173/173 combined ERT tests, 22/22 standalone tests, warning-free core
compilation, clean package installation, isolated socket smoke; GitHub CI passed
on Emacs 29.1 and 30.2. Prior JSON extraction evidence describes the earlier
in-repository layout and is retained as historical evidence.

## Production-threshold scheduling/storage audit, 2026-10-11

Isolated fresh batch Emacs and a durable temporary chat exercised the unchanged
128,000/64,000 main and 32,000/16,000 compaction UTF-8 byte budgets, concurrency
8, and 1,024 records. Eight real injected-backend parent callbacks were held:
main size reached 150,804 bytes, cursor 300, and both batching flags remained
pending. Injecting offline failures into those callbacks, closing and reopening
preserved both rendered views and cursor exactly, including pending batching.
Normal append/scheduling then recovered the work. The continuation observed five
main drops and 22 compaction drops; final sizes were 99,960 and 19,432 bytes.
Ten-level zoom returned both children; originals 0, 299 and 1023 reconstructed
exactly with 64-byte pagination. Final reopen preserved both views exactly.
Retained fixture text included RETAIN_42, old.csv explicitly superseded by
final.csv, budget 2300, E_RETAIN_6, unverified pagination, open task, Lisp authority
and canonical-memory/ledger restrictions.

Evidence: `/tmp/slopchat-threshold-audit.el` and
`/tmp/slopchat-threshold-audit.log`, process-20 exited 0. Existing memory
regressions passed 44/44, zero unexpected, process-21 exited 0; log
`/tmp/slopchat-threshold-regressions.log` (15:05:57-0400).

Limits: this is deterministic scheduling/storage evidence, not a new production
model semantic-quality trial. The injected backend returns a fixed attributed
490-byte line; retained facts therefore verify storage, not model selection or
compression quality. The earlier 16-message gpt-6-luna multilevel fixture remains
the semantic smoke evidence; production-threshold model semantic fidelity is
still unverified. The initial fixture stalled at 7,940 bytes because eight held
parents exhausted concurrency before later model-required leaves could publish;
short source leaves were used instead to isolate parent-stalled batching. An
initial pagination assertion also failed because changing the application variable
did not update the captured memory policy; explicit fixture policy refresh fixed
that harness issue. These failed runs are not successful audit results.
No server restart, production activation, canonical chat/ledger or .references
edit, agent spawn, or commit was performed. Temporary chats were removed.

### Final bounded threshold evidence, 2026-10-11
300 temporary records with real gpt-6-luna parent merges: peak 131414 -> final 63699 bytes; batches cleared, no failed jobs, originals/reopen exact. Merged decision and correction survived. Final failure/open-task/restrictions stayed in a leaf, so threshold-scale compressed retention of those facts remains the sole specific follow-up for this audit. Logs: /tmp/slopchat-threshold-model.log. Do not expand this into indefinite reliability testing; one targeted merge of these final facts completes the agreed bounded acceptance, not a universal guarantee.

## Final compressed-failure threshold check, 2026-10-11

The isolated 300-record production-model fixture moved the failure/open-task record to message 7 so it was compressed into node (3 0), rather than remaining an original leaf. With gpt-6-luna, the view crossed 128,000 bytes (peak 131,414) and shrank to 63,581. The actual multiline node retained E_RETAIN_6, task open, pagination unverified, no restart, and preservation of canonical memory and ledger. All seven literal assertions passed; exact original recovery and rendered-view reopen identity passed. Process-32 exited 0; evidence: /tmp/slopchat-threshold-final.el and /tmp/slopchat-threshold-final.log. The initial construction attempt failed with void-variable FAILURE before the corrected fixture ran. A single-line grep initially hid the retained facts; the full multiline excerpt confirmed them.

This closes the agreed bounded retention/batching audit checklist, not a guarantee of arbitrary semantic fidelity or billed cache savings. No additional acceptance checks are required for this checklist. Canonical memory and ledger were untouched; no server restart, activation, or commit.

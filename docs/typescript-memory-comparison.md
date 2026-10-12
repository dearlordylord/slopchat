# TypeScript memory adoption comparison

2026-10-12. Compare actual execution and integration boundaries, not popularity.
The intended project and the identity of `Oracle` are not yet specified. The
independent executable reference below is the **UNII merge rule**, not an
unidentified Oracle application and not a semantic oracle for LLM output.

## Decision

For a TypeScript host adopting Pi Durable, **optchat-durable is the stronger
ready-made candidate**: supported SDK, durable request admission, frozen context,
failure stops inference, persisted main and compactor partitions, and recovery
tests. Adoption also means accepting Pi Durable/Chord and their conversation,
model configuration, task registry and storage lifecycle. It is not a replacement
for a small memory component behind an arbitrary summarizer callback.

For a host retaining its own agent/model loop, **pi-optchat's Memory + Store are
the smaller extraction candidate**, not an immediately interchangeable package.
Its core imports Node builtins and takes a Compressor callback, but the published
package is a Pi extension without supported library exports. Budget accounting,
readiness, async durable admission and diagnostics need deliberate changes.
Our independent Lisp module is a useful behavioral reference for that extraction
or port. It is not a TypeScript implementation and currently needs Emacs/Linux.

Primary source assessment and commit-permalink citations:
[source review](typescript-memory-source-review.md).
Actual outcomes and exact revisions: [execution evidence](typescript-memory-execution.json).

## Fixed subjects and validation

| Subject | Fixed commit | What ran here |
| --- | --- | --- |
| pi-optchat 0.8.4 | `2bdbd4df63c696fabc06ee9bc616245083069097` | TypeScript check; 283 tests passed, 1 skipped; custom core probes |
| optchat-durable 0.5.0 | `6b2285cf88ab803d859a0efb038610f2a003ff50` | TypeScript check and build; 108 tests passed, 1 cancelled on timeout; documented SDK example passed |
| unii-memory | `7567c83f9b68a7d51c8971ade104a3d0a1f1ecde` | 22 standalone ERT tests passed; same custom merge cases; operational probes |

Node 24.20.0, Linux arm64. Dependencies installed from lockfiles with lifecycle
scripts disabled. Fixtures use temporary directories and deterministic or faux
summaries. No real model calls, production server restarts or main-chat writes.
These are not cost, cache-hit, throughput or answer-quality benchmarks.

The durable suite returned nonzero. Its continuous native cache rehearsal reached
its own 180-second timeout and left its worker alive. I terminated **that worker
only** after timeout; the other 108 tests completed. It therefore does not count
as a passing complete suite. The cause is not established: do not translate this
into a claim that production caching or memory correctness is broken. The smaller
SDK demo and failure, queue, tree, view-state, crash-recovery and native integration
tests passed in the same environment. Reproduce the long scenario in the intended
runtime before adopting; performance qualification remains open.

## Execution against an independent reference

`scripts/memory-comparison/run.py` generates 181 fixed-seed cases. It calculates
the winning available sibling pair from the last inclusive message's age divided
by span, using exact rational arithmetic and oldest-first tie breaking. Cases
vary partitions and missing parent availability, including the specification's
10-message counterexample to first-message age. It does not import any candidate
to calculate expected results.

All three matched **181/181**. For durable, a budget one byte below the current
render forces one available merge; pi and Lisp expose the pair-selection helper.
All three calls exercise implementation code; they are white-box algorithm tests,
not proof of the entire scheduler, byte budget or semantic summary quality.
Durable's upstream independent rollback-counter test also passed for 20,001 pushes.

## Operational differences

| Behavior | pi-optchat core | optchat-durable SDK | Our Lisp module |
| --- | --- | --- | --- |
| Model invocation | Caller supplies Promise-based Compressor + AbortSignal | Host supplies Pi Models, runtime executes generation tasks | Caller supplies async start/emit/done/cancel backend |
| Failed summary | `settle('turn')` resolves stalled failure; render contains placeholder | Failed preparation blocks main generation | Failed snapshot has no usable prompt text |
| Oversized result | Core commits nonempty 700-byte reply after one callback | Size retry policy belongs to durable task; five attempts retain shortest | Five attempts retain shortest valid candidate, even over target |
| Async durable admission | `append()` can return before a custom Store write settles | Queue request/task commit precedes admission receipt | append receipt follows durable journal write |
| Read isolation | Core root/tree/view expose mutable objects | Durable documents/transactions have a different host-owned API | Public reads return owned copies |
| Context budget | Core measures flattened text, excluding address/wrapper markup | Complete UTF-8 rendered markup included | Complete UTF-8 rendered markup included |
| Saved state | Main partition saved; compactor partition reconstructed | Both partitions and incomplete batching targets persisted | Both partitions and batching state persisted |
| Single writer | Pi app supplies profile lock; raw core host must supply ownership | Standalone app locks; SDK host supplies ownership | open holds exclusive directory lock |
| Semantic constraints | Core accepts any nonempty callback text | Task/prompt rules, no semantic validator hook equivalent found | Optional validation policy; SlopChat supplies source-boundary checks |
| Diagnostics | Progress/error in core, usage in separate Pi application ledger | Native Pi tasks/events, frozen request and harness-wide usage | Public attempt details, captured request payload, events, usage coverage |

The failure, oversized, async receipt and mutable-read rows were reproduced in
custom pi probes; the equivalent Lisp failure/oversized behavior was reproduced
in the same run. Durable corresponding behavior was exercised by upstream tests.
The one-callback oversized observation is **core-only**: pi's production
`createCompressor` separately retries up to five times and by default tolerates
640 bytes. Do not describe its full Pi application as having no retry policy.

For a 40,000-byte Unicode record, raw pi `append()` kept one record; Lisp returned
two record IDs. Pi's host has separate transcript normalization, so core adopters
must supply their own clipping/splitting policy rather than assume full-app behavior.
The mutable-read probe changed `root[0].text` and subsequent zoom reflected it.
The asynchronous Store probe returned receipt ID 0 with one visible in-memory
record while zero records were persisted.

At 96 records and an 8,000-byte budget, pi reported measured text of 7,600 bytes
while the actual rendered view was 7,730 bytes. This establishes the accounting
difference, not a demonstrated over-budget prompt at default settings. Reopen
preserved the main and compactor views in both custom reopen fixtures. The source
shows compactor reconstruction, but these fixtures did **not** demonstrate cache
prefix drift; no such observed failure is claimed.

## Caching, visibility and fidelity

Both TS applications optimize Anthropic view prefixes, but their summarizer has
separate instructions and no main-role tools. Sharing the memory text does not
establish identical main/summary request prefixes or the UNII recipe's cross-role
cache reuse. pi's payload helper replaces existing host markers; durable's helper
tries to preserve host markers and policies. A host using another provider needs
its own payload/routing verification. These are source findings, not hit-rate measurements.

Neither candidate's public memory interface directly matches our per-attempt
captured-payload and explicit observed/unknown usage contract. pi's usage ledger
belongs to its application; durable's status usage is harness-wide. Instrumenting
Pi hooks can bridge some of this, but must be designed and tested. Our counters
also depend on explicit backend observations; they do not manufacture provider data.

Neither synthetic summaries nor passing storage tests establish source fidelity.
SlopChat's author/tool boundary checks are application policy passed into Lisp,
not a universal proof that the generic library preserves every fact. Before a
real-model comparison, hold corpus/model/provider fixed and evaluate quoted
requests, negation, author attribution, tool outputs, identifiers and repeated
compression; retain attempts and observed usage. No adoption winner on semantic
quality or real cache savings is established here.

## Reproduction and adoption gates

Check out the exact commits above in temporary directories, run `npm ci
--ignore-scripts`, and run their check/test commands. For durable also run
`npm run build` and `node examples/native-host.mjs`. Record timeouts explicitly.

```sh
python3 scripts/memory-comparison/run.py /path/to/pi-optchat /path/to/optchat-durable
emacs --batch -Q -L vendor/unii-memory \
  -l vendor/unii-memory/tests/unii-memory-test.el -f ert-run-tests-batch-and-exit
```

The custom runner requires Node 24's experimental TypeScript transformation;
that is a fixture convenience, not either package's production installation path.
It records actual checkout revisions and makes no paid calls.

Before selection, identify whether the project uses Pi Durable, Node/Bun or browser
execution, and its own LLM loop/storage. Then require ready/pending/failed behavior,
durable acceptance, bounded attempts, immutable external reads, honest usage
coverage and the desired diagnostics. For a Pi Durable project, start a bounded
SDK integration trial. For an independent runtime, prototype a supported core
wrapper around pi Memory/Store and address the table's gaps before production.

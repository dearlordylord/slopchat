# Cache-affinity A/B decision

Decision: reject the current metadata-only-fork candidate for production. Preserve it as an experimental opt-in module; production memory still uses thread/start.

Eight gpt-6-luna first-attempt calls, four A (thread/start) and four B (ephemeral metadata-only fork), ran on a fixed synthetic archival-memory fixture with identical input hashes inside each pair and alternating order. Every thread had an explicit empty initial history and a unique ID. All outputs were semantically correct and at most 512 UTF-8 bytes; no tools executed. Complete provider total/last usage was retained. Tests passed 3/3.

| Arm | Pair | Input | Cached input | Uncached input | Output |
|---|---:|---:|---:|---:|---:|
| A | 0 | 35201 | 1792 | 33409 | 21 |
| B | 0 | 33105 | 1792 | 31313 | 20 |
| B | 1 | 33105 | 32512 | 593 | 20 |
| A | 1 | 35201 | 0 | 35201 | 20 |
| A | 2 | 35201 | 34560 | 641 | 20 |
| B | 2 | 33105 | 32512 | 593 | 20 |
| B | 3 | 33105 | 32512 | 593 | 20 |
| A | 3 | 35201 | 1792 | 33409 | 20 |

| Arm | Total input | Cached input | Uncached input | Output | Mean uncached |
|---|---:|---:|---:|---:|---:|
| A | 140804 | 38144 | 102660 | 81 | 25665 |
| B | 132420 | 99328 | 33092 | 80 | 8273 |

Observed mean uncached input was 67.8% lower in B. This is a descriptive comparison of the tested paths, not a causal or production economy claim. B reused 32512/33105 input tokens in its last three independent threads; A also achieved one large cache hit (34560/35201), so new thread IDs do not prohibit cache reuse.

The candidate is rejected despite passing the numerical threshold: A and B provider input totals consistently differ by 2096 tokens, although local serialized inputs and base instructions match. Effective provider context/tool parity has not been proved. The fixture is synthetic and does not establish real memory summary quality or long-term economics. Do not assign the entire observed difference to cache affinity or translate token counts into billed dollars. Cache-write input was reported as zero in every sample; this does not identify actual cached node boundaries.

Evaluator repair: AB1 stopped after one valid role-prefixed A summary because the validator expected the same content without the user: prefix. AB2 accepted the optional prefix, revalidated that retained observation offline, and made only the remaining seven calls. The first observation is retained historical evidence, not a new repeat. Total model calls across both executions: eight. Managed correctness checks passed; native execution and immutable output receipts are recorded under the shared Git-private Autoresearch outcome. No production integration, branch creation, commits, canonical memory edits, or server restart occurred. The isolated checkout is detached at cbb1090 with the exact current Lisp/test files copied in.

Evidence: [full observations](memory-cache-affinity-ab.json). Outcome executions: AB1 (validator failure), AB2 (completed with current checks). The successful outcome criterion means the bounded comparison is completed; it does not accept the code or prove causal cache improvement.

Follow-up would require a separately authorized experiment: establish equivalent effective provider context/tools first, then run a fresh balanced comparison on representative memory workloads. The current eight-call allowance is exhausted; do not rerun this evaluator automatically.

## Subsequent fix

This report retains the original runtime-incomplete candidate and decision. Follow-up identified missing multi_agent_version (legacy V1 fork versus V2 fresh model), corrected it, verified exact input parity and activated the corrected solution. See [current solution](memory-cache-solution.md). The original trial is not silently reclassified or rerun.

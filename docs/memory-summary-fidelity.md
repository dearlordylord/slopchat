# Summary source fidelity repair

The live audit found that summaries of records 7258/7259 asserted execution of a historical tool request, record 7261 lost a supplied six-entry result, and parent (1 3629) inherited the false completion claim. Earlier record 7185 exposed a related problem with clipped results and nested sample counts. Logs for October 8–11 and the recorded failed tree nodes were inspected.

## Repair

Task-local source metadata describes the outer author, quoted historical record, supplied collection count and unavailable summaries (`nil` does not establish an active pending job). The canonical source remains unchanged. JSON strings containing JSON records are decoded as quoted data. Lisp collections are parsed only when complete and without reader-constructor syntax; text is never evaluated. Echo output at the 30,000-character clipping boundary has unknown completeness, even when head/tail concatenation happens to parse.

Missing or invalid summary fields leave availability unknown; a property object is not counted as an array of results. Every leaf rejects standalone author tags absent from its source.

Structured echo summaries must begin with a factual prefix preserving that boundary. A nested author cannot become an independent author-tagged event. Merged summaries preserve source author tags for retained facts, quoted requests with unestablished execution, and unknown totals of clipped results. Capitalization of generated author tags is normalized; equivalent empty-only replies are canonicalized from the empty source. Omitted low-value acknowledgements need no author tag. Original messages are unchanged.

Attempted tool calls cannot turn the provider denial into a source fact: the attempt is marked failed, records a `summary-tool-rejection` event, and requests a data-only correction. Boundary violations request another response within the existing five-attempt limit. Invalid responses never become the retained shortest candidate. Exhaustion marks the job failed rather than publishing a false node. Valid over-limit candidates retain the existing size-policy behavior. Every provider attempt, including a rejected answer, remains accounted for in the existing ledger. Immutable request events expose `summary-validation`, `source-boundary`, `passed`/`rejected`, rejection reasons, raw responses and any normalized response. `passed` means these structural checks passed, not that all semantics are proven.

Shared provider instructions, tools and cache-anchor configuration are unchanged. Metadata is appended to the task after its existing memory prefix.

## Evidence

- [Exact source records](../tests/fixtures/memory-nested-results.json) and [recorded failed summaries](../tests/fixtures/memory-summary-failures.json) preserve the reproduction cases. The stored leaf failures are rejected against their original sources; the stored parent completion claim is rejected when merging correctly attributed child lines.
- [Regression tests](../tests/slopchat-fidelity-test.el) cover authors, nested requests, six results/two unavailable summaries, empty versus absent results, clipped data, parent propagation, constructor rejection, retry exhaustion, and rejected-attempt usage/events.
- Full isolated ERT: **149/149**, zero unexpected. TypeScript typecheck passed; Bun: **52 tests, 207 assertions**, zero failures. Existing UI edits were preserved.
- [Production-model replay](memory-summary-fidelity-evidence.json): six leaves and four parents, explicit empty and missing results, plus unchanged rendering after reopen. Its isolated ledger reports 19 attempts, 242,325 input, 198,144 cached input and 2,149 output, coverage 19/19. These are regression-work counters, separate from the live chat ledger. The final replay uses unavailable-summary counts. Supplementary guards were also checked offline against retained responses; those reviews are not extra provider trials.
- Production-model retention and unrelated-topic smokes retained corrected paths, restrictions, open work, error IDs and author/source separation. Reopen was identical. Logs: `/tmp/memory-fidelity-retention-final.log` and `/tmp/memory-fidelity-unrelated-final.log`.
- The source-only production probe retained `(error "SOURCE_ONLY_PROBE")` as a request with unestablished execution and no supplied outcome; `/tmp/memory-source-only-probe.log`. Unit regression additionally forces a rejected tool call and proves its denial cannot become a canonical node.
- Narrow activation on the existing server preserves ledger identity, views, cursor/count, agent and shared instructions/tools. [Live evidence](memory-summary-fidelity-live.json) records real validation events and the appended correction note.

Run the provider-free regressions with `emacs --batch -Q -L lisp -l tests/slopchat-fidelity-test.el -f ert-run-tests-batch-and-exit`. The opt-in production replay is `emacs --batch -Q -L lisp -l scripts/memory-fidelity-smoke.el`; it uses a temporary chat, makes real model calls and writes `/tmp/memory-fidelity-evidence.json`.

A live merge exposed an over-strict all-authors check that rejected omission of a service acknowledgement. That condition was removed: retained tags must come from the source, while omitted facts need no tag. Node (3 909) recovered through normal retry; the live server returned to zero active/failed summaries. The incident and spent attempts remain recorded.

## Limits

The recorded boundary failures are covered; general semantic fidelity through arbitrary repeated compression remains unproven. These checks cannot prove every number, attribution or omitted fact. Historical nodes remain immutable under the design. Correction notes 7279 and 7288 explicitly supersede the identified false claims through the normal append protocol, including the later denial-as-action-result error; original logs and old tree nodes were not rewritten. No server restart or ledger reset occurred.

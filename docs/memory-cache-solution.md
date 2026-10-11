# Cache solution exploration and implementation

The initial A/B rejection was a checkpoint, not a resolution of the cache issue. Follow-up source inspection found the missing runtime field in the synthetic metadata-only anchor: Codex 0.162.1 treats a fork without multi_agent_version as a legacy V1 session, whereas the local gpt-6-luna model catalogue selects V2 for a new session. Dynamic tool definitions were present; the built-in runtime/tool surface could still differ. Relevant pinned sources: [runtime fallback](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/core/src/session/mod.rs), [session metadata](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/protocol/src/protocol.rs), [cache-affinity override](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/core/src/client.rs).

| Option | Evidence / decision |
|---|---|
| New thread/start with explicit cache key | Installed schema has no root cache-key override. Not a native solution in this protocol. |
| Fork a never-used started anchor | Ephemeral and persistent thread IDs both failed with no rollout found. |
| Reuse a used conversation across nodes | Violates independent contexts; rejected without trials. |
| Metadata-only rollout fork | Supported, empty histories verified. Fix missing runtime metadata instead of replacing the idea. Selected. |
| Change Codex transport to expose a root routing key | Upstream internally supports an override; a custom binary is feasible but adds build/maintenance cost. Unnecessary while the native fork path works. |
| Switch provider/API | Changes authentication, billing and operational behavior; unnecessary for this subscription-backed solution. |
| Reduce compaction calls through batching | Complementary existing work, not a substitute for fresh-context cache reuse. |

The corrected anchor reads the model runtime from Codex's local models_cache.json, writes explicit multi_agent_version and rejects absent/invalid runtime metadata. One ordinary correctness smoke with unchanged input/instruction SHA-256 returned 35,201 input, exactly matching the original A, and 34,560 cached input with a valid 20-token output. This removed the observed 2,096-token discrepancy on that fixture; it is not a fresh repeated A/B or a broad savings claim. Evidence: memory-cache-runtime-fix-smoke.json. The previous eight-call comparison remains frozen in its assessed checkout and is not overwritten or rerun.

Production integration is limited to summaries. Matching directory/instructions/tools/model/runtime/connection-config share one metadata-only anchor per connection, while each node gets a distinct empty ephemeral fork. Anchor identity/runtime/hash are captured with the actual fork request; the inspector reads tool definitions from the captured anchor metadata. Settings changes get another anchor. Files are removed when the connection closes. Unsupported runtime/fork paths fall back to the original thread/start, with route/reason retained in provenance. Main turns continue using their existing adapter.

Verification: 105/105 ERT checks across memory, model/context, inspector and cache candidate. Existing accounting is not reset. Live activation uses an idle timer preserving agent function, main/compaction views, count/cursor and ledger identity. Live routing verification completed below.

## Working-server verification

Activation at 2026-10-11 03:57:57 UTC preserved PID 3408388, main/compaction views, count/cursor 6919 and the accounting ledger identity. No restart. One factual maintenance note was appended through the normal note protocol, producing ordinary summary-tree work; no existing records were rewritten.

Four independent production streams used one metadata-only anchor and runtime V2. Their first calls reported:

| Node | Input | Cached input | Uncached input | Cached fraction |
|---|---:|---:|---:|---:|
| (0, 6919) | 16706 | 2816 | 13890 | 16.86% |
| (1, 3459) | 16804 | 16128 | 676 | 95.98% |
| (2, 1729) | 16830 | 16128 | 702 | 95.83% |
| (3, 864) | 16876 | 16128 | 748 | 95.57% |

These are first attempts in different threads, not same-thread correction retries. All four use the same captured anchor ID. Initial histories are rejected unless explicitly empty by the creation helper. The inspector's captured eval tool definitions match the production tool vector exactly; instructions remain available.

Including all existing-policy correction retries, 14 attempts incurred 240583 input, 214528 cached input, 26055 uncached input and 1720 output tokens, with 14/14 coverage. One cumulative maximum per thread reconciles exactly to the unchanged ledger's increase. Final active/failed summary counts are both zero. Evidence: `memory-cache-live-routing.json`.

The fix is enabled for production memory summaries, with native start fallback. Observed cache reuse is now high between independent real summary streams after the initial miss. This is runtime evidence on this workload, not a guarantee of future hit rates, a fresh controlled A/B, exact cached node attribution, or billed-dollar savings. The earlier rejection applies to the old anchor missing runtime metadata and is superseded for the corrected implementation.

Validation: combined relevant ERT 105/105 before the final catalogue regression; focused cache suite 7/7 afterward; diff check passed. The existing TUI needs no client replacement because this inspector/provenance change is projected by the Lisp server through the existing protocol. No commits; frozen original trial checkout/receipts remain intact.

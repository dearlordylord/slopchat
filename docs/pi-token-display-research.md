# Pi token display

Primary source inspection (2026-10-10; upstream main, not a pinned revision).

- The footer displays cumulative session input/output/cache-read/cache-write token counters from recorded usage, not a per-section breakdown. It separately displays context percentage and model limit.
- Context size uses the last valid assistant usage plus estimates for subsequent messages. Context edits/compaction invalidate older usage; after compaction the context display remains unknown until a valid subsequent response.
- Local estimates use ceil(character count / 4), with special handling for images and tool content; they are not exact tokenizer counts.
- Pi therefore combines provider-reported tokens with estimated context tokens. Its provider-specific cache formula must not be copied onto Codex counters without validating their semantics.

Sources:
- https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/modes/interactive/components/footer.ts (getSessionStats, render)
- https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/agent-session.ts (getContextUsage)
- https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts (calculateContextTokens, estimateContextTokens, estimateProjectedContextTokens, estimateTokens)

Implication for SlopChat: show tokens, not character counts as the primary metric; distinguish reported per-call usage from locally estimated section counts. Memory is part of input, not an additional additive category. No implementation change in this investigation.

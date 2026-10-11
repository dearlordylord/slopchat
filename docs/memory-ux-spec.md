# Memory visibility UX specification

Status: planning only; no implementation approved by this document.
Date: 2026-10-09.
Research and source caveats: [memory-ux-research.md](memory-ux-research.md).

## Scope and priorities

Make agent context and memory operations observable during work without flooding the chat. Develop software architecture and user-facing interaction together. Work through the numbered items sequentially, not as one large implementation.

First increment: (1) exact context inspector, (2) quiet live memory rail, (3) inline memory lens. Then (4) switchable resolution timeline and (5) compaction inspector. Item 6 is deferred until all other work and a separate discussion. Developer diagnostics are cross-cutting validation, not a new competing UI.

All items below are proposals requiring detailed design and review. Checkboxes are unfinished work, not claims of completed research or tests.

## Shared rules

- Lisp owns memory, immutable request snapshots and event truth; UI is a projection, not another source of authority.
- Distinguish journal, summary tree, current view, exact sent input and rendered chat.
- UI browsing never silently changes the agent context. Attaching a reference is a separate explicit action.
- Keep original records and stable source identifiers. A historical inspector must not substitute today's view for yesterday's input.
- Bytes are not tokens. Show measured tokens only when available; unknown limits, usage and cache telemetry are unknown, not zero.
- Animate real work, stop animation at completion/failure/cancellation, group routine events, and keep failures accessible.
- Preserve draft, cursor, selection, focus and chat scroll when opening or closing inspectors.
- Commands, bindings and their hints must be single-sourced. No final new binding is chosen yet.

## 1. Exact context inspector and compact context indicator

Provide an immutable per-call screen answering: what did the agent actually receive? Link it from the relevant reply/call. Separate instructions, memory view, new user input, tools and subsequent retrieved content; distinguish initial input from later tool exchanges. Show call identity, revision, node coverage/resolution and sizes with explicit units. This is not the current /map.

On the main screen, investigate a tiny graphical context element in a bottom strip, possibly below the composer, with useful detail accessible on demand. Avoid implying a percentage of the model window unless both token usage and the applicable limit are known.

Investigate cache usage beside this element and in the inspector. Verify available provider telemetry, scope (per call versus cumulative), cached-input accounting and update timing. Distinguish unavailable data from no cache hit; do not infer cache hits from repeated text. Research Pi's presentation as a reference, not as verified behavior or a design to copy blindly.

Opening design is unresolved: a dedicated screen like /map, an inspector panel, a command or a binding. Compare these with small-terminal layouts and existing shortcuts before choosing.

### TODO 1

- [ ] Revisit and discuss item 1 acceptance with Igor; agree on remaining scope and checks, then explicitly finish acceptance. Item 1 remains open until discussion and verification.
- [ ] Expand the data contract and snapshot lifetime/retention design; identify the actual request assembly boundary.
- [x] Research primary sources and local provider routing; verify Pi implementation. See [context-cache-research.md](context-cache-research.md). Live emission/accounting verification remains open.
- [ ] Compare software and visual designs, including opening/return behavior and bottom-strip placement, with Igor.
- [ ] Examine corner cases: queued requests, compaction between calls, cancellation, failed/auth-rejected calls, missing telemetry, model changes, tool exchanges, truncation and sensitive input retention.
- [ ] Define and run tests/prototypes demonstrating immutable historical input, truthful metrics, narrow layouts and state preservation before implementation acceptance.

### TODO 1.1 — request snapshot contract (draft for review)

Local evidence: `slopchat--start-input-body` captures a memory prefix and prompt; a round can contain multiple `agent-model-function` calls. `slopchat-model-response` creates a fresh thread per call, appends adapter instructions and serializes the conversation. `slopchat-codex-thread` assembles `thread/start`, `slopchat-codex-run` assembles `turn/start`, and `slopchat-codex-send` serializes and sends JSON. A round snapshot alone cannot represent every call.

Proposed contract:

- Round identity links the accepted input and processing attempt. Each model invocation has a separate call identity, ordinal and purpose; these differ from provider thread/turn IDs and tool `callId`.
- Capture immutable copies of actual assembled thread-start parameters and turn-start input before sending: instructions, tools, serialized conversation, requested model/configuration and directory. The serialized payload is authoritative; derived sections must not become another prompt builder.
- Capture ordered memory ranges and rendered text when constructing the prompt. Carry that provenance into subsequent calls rather than consulting the later current view. A snapshot identity is needed; no existing formal view revision is assumed.
- Record live steering as separate append-only events with acknowledgement or rejection. Tool exchanges included in the next fresh call are part of that call's initial conversation. Initial payloads never change.
- Separate prepared, locally sent, provider acknowledged and terminal outcome. Local send success does not prove model receipt. Failed/auth-rejected attempts retain attempted payloads; uncertain delivery remains unknown.
- Requested model and provider-confirmed resolved model are distinct. Usage/cache observations are optional, timestamped metadata. UTF-8 byte counts are not token counts. Provider-added or transformed context is outside local visibility; label this as exact locally submitted input, not the entire provider context.

Retention proposal, not implemented: session-only storage outside the journal/summary tree; retain active calls plus the latest 100 terminal calls within a shared 32 MiB payload budget per chat, evicting oldest terminal calls first. Active oversized calls remain inspectable until completion, then may be evicted; never silently truncate an exact snapshot. Historical links explicitly report eviction or restart unavailability. Durable retention/export requires separate opt-in consideration because instructions, paths and tool outputs may contain secrets. Ordinary diagnostics must not duplicate payloads.

Retention decision (Igor): use session-only snapshots for now; restart loses them. Keep the design simple and extensible. Numerical limits remain provisional. Capture, storage, UI and tests are not implemented. Next checklist task is provider/cache/Pi research, not implementation.

Snapshot availability is an ordinary domain state. Every consumer must handle absence: before capture, for older calls, after eviction or restart, and if future durable storage cannot supply a snapshot. Show a reason only when supported by evidence; otherwise show unavailable. Keep historical call/source links usable independently. Never reconstruct an exact snapshot from current memory, substitute another call, or show missing metrics as zero. An unavailable inspector must preserve draft, focus and scroll and provide a normal return path. Future disk persistence does not remove this contract. Required tests cover restart, eviction, unknown reasons, surviving links and UI state preservation.

## 2. Quiet live memory activity rail

This is part of the compact context/memory strip proposed above, not a separate chat message for every merge. Show real summarization, pending work, agent retrieval/zoom and view publication. A built summary and a summary included in a published view are different events. Expand grouped activity for details and persistent errors.

Exact placement and whether expanded activity is inline or a panel remain design questions. The strip and item 1 should share a coherent presentation and authoritative data rather than duplicate counters.

### TODO 2

- [ ] Revisit with Igor whether richer memory statuses need an event contract, and discuss its scope before implementing events or history. For now retain Lisp-reported summary counts on the right side of the composer shortcut line.

- [ ] Expand event identities, lifecycle, ordering, grouping and bounded retention.
- [ ] Research actual Lisp operation boundaries and relevant primary-source UX precedents.
- [ ] Design strip animation, quiet idle state, failure visibility and expanded history together with item 1.
- [ ] Examine corner cases: simultaneous jobs, repeated merges, stale/out-of-order updates, reconnect, cancellation, failure/retry and publication without a visible size change.
- [ ] Prototype and test real-work-only animation, grouping, publication distinction and repeated open/return transitions.

## 3. Inline memory lens and source navigation

Expand a source-linked memory reference beside a chat message: summary to children to original, without requiring a trip to /map or losing the current draft/scroll. Clearly distinguish an agent's actual retrieval from the user's browsing. Offer an explicit reference attachment to a future message only after its semantics are agreed; viewing alone is read-only.

### TODO 3

- [ ] Expand stable reference, original pagination and attachment semantics.
- [ ] Research existing source-navigation patterns and local zoom behavior.
- [ ] Compare inline expansion versus a temporary panel; agree on opening, closing and returning.
- [ ] Examine corner cases: very long originals, missing references, changing current view, multiple lenses, cancelled requests and references to historical snapshots.
- [ ] Prototype and test source fidelity, read-only browsing, explicit attachment and preserved composer/chat state.

## 4. Switchable /map views and temporal resolution map

Keep both the existing tree/list explorer and a new temporal resolution view; allow switching between them rather than replacing the existing explorer. The timeline is chronological, not a semantic topic map: recent small blocks, older larger blocks, with message coverage, identity, time range and detail level. Distinguish sent/current-view nodes from archive-only descendants. Expanding a parent reveals its children; do not invent importance or confidence scores.

### TODO 4

- [ ] Expand shared node data and per-view navigation/state preservation.
- [ ] Research chronological resolution visualization and terminal constraints.
- [ ] Design the mode switch, legend, selection and historical-snapshot overlay without losing the existing explorer.
- [ ] Examine corner cases: uneven coverage, huge histories, long labels, tiny terminals, wraparound, resize and changed view revisions.
- [ ] Prototype and test both modes, switching, keyboard/Shift navigation, scrolling and source coverage accuracy.

## 5. Compaction inspector

For a selected merge show both child summaries and the parent summary, their source coverage and lifecycle/publication status. Enable factual comparison of constraints, corrections, unresolved questions and proposed versus completed work. Do not claim a measured percentage of semantic loss. Integrate access with the map and activity details where appropriate.

### TODO 5

- [ ] Expand merge provenance, revision and failed/pending/published distinctions.
- [ ] Research compaction behavior and available historical data.
- [ ] Design readable comparison for narrow terminals and long summaries.
- [ ] Examine corner cases: retries, failed compaction, unpublished parents, repeated merges and missing metadata.
- [ ] Prototype and test exact child/parent provenance and preservation of user instructions, corrections, uncertainty and completion evidence across repeated merges.

## 6. Memory corrections — deferred, discussion required

Record this possibility, but do not implement it now. Revisit only after the preceding work and a fuller discussion with Igor. A possible correction is an append-only message with a source reference, not rewriting the journal or old summary nodes. Durable pinning/promotion would change prompt budgets and cache behavior and requires a separately approved authority and invalidation policy.

### TODO 6 (deferred)

- [ ] After items 1–5, discuss correction semantics and whether this feature is wanted.
- [ ] Only then research policies, expand the specification, examine conflicts/corner cases and agree on software/UX design and tests.

## Completion gates

For each numbered item: expand the specification, investigate sources, reason through alternatives and corner cases, agree on the software plus visual design, then prototype/test and evaluate actual behavior. Do not skip directly from this outline to implementation. Keep detailed designs and checklists in this file so requirements remain single-sourced; link to research rather than duplicating it.

### TODO 1.2 — telemetry research outcome

Research completed; no runtime implementation. Preserve optional call-correlated provider observations, last and total separately, with source and receipt time. Bytes are not tokens. Pi accounting must not be copied to Codex. Cache percentages and live occupancy remain deferred until provider semantics and live emission are validated. Missing data is unavailable. Next: compare inspector layouts and opening/return behavior with Igor.

### TODO 1.3 — approved direction and next validation

Igor approved a dedicated `/context` screen as the initial inspector, with historical call links, on-demand sections and Escape returning without losing composer or chat state. Iterate after observing the implementation; no side panel is required.

Provider-neutral contract: local call identity, immutable submitted input, optional token observations, applicable context limit, observation scope/source/time and availability. Provider adapters own field mapping and accounting semantics. Codex is the first adapter, not the domain model; future Claude support must not require changing inspector semantics. Avoid a speculative general provider framework.

User-facing metrics prioritize context percentage and cache percentage, then token counts and applicable context size. Do not show request bytes in the strip or inspector; byte budgets are internal retention mechanics only. A percentage requires a validated numerator and denominator with matching scope; unavailable is preferable to a misleading number. Estimates, if introduced, must be explicitly labelled and provider-appropriate. Pi is a presentation reference, not an accounting contract.

Next validation: run isolated, bounded provider experiments for normal completion and interruption at a dynamic-tool boundary. Record notification receipt timing and reported counts only, not prompts or secrets. Do not restart or modify the running chat server. Any scratch prototype must be removed after its findings are recorded; no dead production code. Then finish corner-case and test design before proceeding to the next numbered item.

### TODO 1.4 — validation result and acceptance cases

The isolated live experiment is recorded in context-cache-research.md. Usage was received for normal completion and an interrupted tool-boundary call; completion can arrive after adapter return. Scratch code was removed. This validates availability in two cases only, not percentage semantics or production capture.

Approved defaults: dedicated /context screen, historical call selection, on-demand sections, session-only snapshots, no user-facing bytes, provider-neutral token/limit/percentage observations. Unknown values remain unavailable. The screen identifies locally submitted input, not hidden provider context. Percentages must name their scope and observation freshness; do not present consumption as live occupancy.

Acceptance matrix before implementation: immutable input across compaction and steering; queued input captured at actual call preparation; distinct call/tool/round identities; normal, tool-interrupted and cancelled terminal outcomes; late and duplicate usage without reopening work; wrong-call events rejected; auth failure and missing telemetry; model/limit changes invalidate incompatible percentages; restart/eviction absence; sensitive payloads excluded from diagnostics; narrow layouts and repeated open/return preserve draft, cursor, selection, focus and scroll. An oversized active snapshot is retained without silent truncation. Each case requires evidence rather than inferred success.

Next checklist task: turn this matrix into the minimal capture/storage and inspector implementation plan, keeping provider mapping at the adapter boundary. Item 1 remains incomplete until implementation and acceptance tests pass; item 2 has not started.

### TODO 1.5 — minimal implementation plan

1. Add a Lisp session-only snapshot store with local call identities, immutable payload/provenance and explicit unavailable results. Keep it outside canonical memory. Capture at the actual model invocation boundary; use one payload builder and observe its output, never recreate requests for the inspector.
2. Add a small optional observation interface at the model-adapter boundary: token counts, limit, scope, source, receipt time and validated accounting capabilities. Keep provider-native fields in adapter diagnostics, not UI contracts. Route late observations independently of active stream lifetime with bounded retention. No general provider framework or Claude implementation now.
3. Expose bounded read-only call listing, snapshot sections and observations through the Lisp UI protocol. Paginate large sections; pagination must not imply that the stored exact snapshot was truncated. Return explicit unavailable states without guessed reasons.
4. Add /context to the shared command registry and a separate screen. Default to the latest call; historical links select a specific call. Show instructions, memory, input and exchanges on demand. Escape returns to the preserved chat state. Keep the indicator quiet: context percentage and cache percentage when validated, token counts/limit next, unavailable otherwise. Do not expose bytes.
5. Test the acceptance matrix in TODO 1.4 using scratch chats and adapter fixtures, plus bounded live checks where fixtures cannot establish timing. Do not claim percentages validated by the two-call trace. Verify narrow-screen rendering and repeated return transitions through production mounting before publication.

Implementation order is store/capture, adapter observations, protocol, inspector/indicator, then integration acceptance. Each stage must preserve existing edits and Lisp authority. This is an implementation plan, not evidence of implemented features. Finish item 1 before starting item 2; no automatic expansion into deferred memory corrections.

### TODO 1.6 — snapshot-store experiment

A temporary Lisp store experiment checked deep-copy isolation on capture and read, retention of oversized active snapshots, terminal eviction and absence in a fresh session. The first run exposed a plist-update bug: adding absent lifecycle keys did not update the retained entry. Predeclaring lifecycle slots fixed it; both focused ERT tests then passed. This is not production integration or acceptance of the full matrix.

The unused experimental module and scratch tests were removed after recording the result. Production storage must include lifecycle slots from creation, isolate mutable strings/containers on both boundaries, and expose unavailable independently of retention implementation. Next stage is production capture/store with persistent regression tests, before adapter observations or UI work.

### TODO 1.7 — production session store

Implemented the session-only store in `lisp/slopchat-context.el`, owned by each chat and released on close. Capture/read copy mutable containers and strings; terminal outcomes are idempotent. Active snapshots are retained without truncation; oldest captured terminal entries are evicted under provisional count/byte limits. Session-qualified call IDs avoid reusing a historical link after reopening. Missing snapshots return explicit unavailable without a guessed reason. Payloads are not written to the journal.

Six persistent focused ERT tests pass: copy isolation, oversized active retention/eviction, terminal ordering, session identities, idempotent finish, and chat close/reopen absence. The core/UI regression run passed 44 tests before adding the sixth test. This is store integration only: actual provider request capture, delivery events, provenance, observations, protocol and inspector remain unimplemented. No running-server activation or restart was performed. Next stage is capture at the real assembled request boundary with adapter fixtures, not item 2.


### TODO 1.8 — request capture boundary

The model adapter now captures the actual locally prepared thread/start and turn/start parameters via the transport observer, without rebuilding the request. The chat supplies the rendered memory prefix and initial input ID as provenance, not the changing current view. Snapshot outcomes distinguish completion, tool boundary, failure and round cancellation. This records prepared input, not proof of provider receipt. Steering events, delivery evidence and late usage observations are still pending; the inspector and protocol are not implemented.

Eight focused ERT tests pass, including a comparison against serialized transport fixture payloads and submission failure. The combined core/UI/context run passed 46 tests before adding the failure fixture and adjusting provenance; the focused suite passed afterward. No running-server activation, restart or commit. Next: lifecycle and steering fixtures, then call-correlated observations independent of stream lifetime.

Lifecycle fixtures now also verify cancelled unwinding and the eval tool-boundary outcome; all ten focused context tests pass. Delivery and steering remain pending.

The combined core/UI/context regression rerun passed all 49 tests (91.7 seconds). The preceding 120-second run timed out and was not counted as success.

### TODO 1.9 — steering evidence

Snapshots now support separately copied evidence events, counted toward retention budgets without modifying original input or terminal outcome. Runs carry their snapshot identity; steering records prepared parameters followed by RPC acknowledgement or failure. Acknowledgement is not proof that the model incorporated the text. Twelve focused context ERT tests pass, including successful and failed steering and post-terminal event isolation. Late usage routing and initial delivery evidence remain pending.

Initial turn/start responses now record RPC acknowledgement or rejection with the returned turn identity. The fixture covers both paths; this is transport evidence, not proof of model incorporation. All 13 focused context tests and the combined 52-test core/UI/context suite pass. Late usage observations, bounded protocol and /context UI remain unimplemented.

### TODO 1.10 — late usage routing (in progress)

The Codex adapter retains a separate 30-second route after run completion and records raw reported usage only for matching thread/turn identities, without reopening terminal snapshots. Fourteen focused ERT tests pass, including late usage after cancellation and rejection of a wrong turn. This is not a completed observation contract: duplicate updates, bounded route cleanup, expiry/close tests, provider-neutral normalization and malformed counts remain open. No percentage semantics are enabled. Protocol and inspector remain unimplemented.

Late routes now share one pruning function on completion, pumping and usage receipt: expired routes are removed and at most 100 are retained. Connection close clears routes after finishing runs, avoiding re-creation during shutdown. Fifteen focused context tests pass, including expiry, count bound and close cleanup. Duplicate usage and provider-neutral normalization remain pending; this stage is not complete.

Identical raw usage updates are now deduplicated per snapshot; changed reports remain separate evidence, never summed as deltas. Sixteen focused context tests pass. Provider-neutral normalization, malformed-count validation and the protocol/UI remain pending.

Adapter normalization now exposes explicitly reported nonnegative token counters under separate last/total scopes and an optional positive context limit. Missing fields remain absent; raw evidence is preserved separately. No percentages are derived. Seventeen focused context tests and the combined 56-test core/UI/context suite pass. Inconsistent counter relationships, malformed container handling, early acknowledgement/usage races and UI protocol acceptance still require work before this stage is complete.

Malformed usage containers are now rejected by normalization without inventing metrics; 18 focused context tests pass. The most recent combined run passed 56 tests before this validation addition. Early submission races and inconsistent counters remain open.

Snapshot identity is now attached at turn preparation, before transport submission, rather than only after run creation returns. The combined 57-test core/UI/context suite passes. A dedicated early-response fixture remains required; protocol and inspector are still pending.

The dedicated early-response fixture now verifies acknowledgement and usage delivered synchronously during submission, before adapter run creation returns. All 19 focused context tests pass. Counter consistency validation and protocol/inspector work remain open.

Reasoning-output counts exceeding reported output now make that scope unavailable while preserving raw evidence. Twenty focused context tests pass; the last combined run passed 57 tests before this addition. Protocol and inspector remain pending.

The latest combined core/UI/context regression run passed all 59 tests. Next is the bounded read-only context protocol, then the inspector UI. No server activation or restart has been performed.

### TODO 1.11 — bounded context protocol (in progress)

Added a read-only context action returning the latest or a specified session snapshot with bounded payload pagination (maximum 8000 characters per page) and explicit unavailable results. Twenty-one focused context tests pass, including lossless pagination, invalid requests, missing IDs and no journal writes. Call listing, section selection, observations and inspector UI remain pending; this is not a completed context screen.

The combined core/UI/context suite passed all 60 tests after the initial context protocol addition. This validates the bounded payload read only; call listing, section selection, observations and inspector UI are still open.

Bounded context-calls listing now exposes session IDs and lifecycle metadata only, without private payloads. All 22 focused context tests pass, including list bounds, paging and invalid offsets. Section selection, observation reads and inspector UI remain open.

Context pages now support explicit payload, provenance and evidence-event sections with the same bounded pagination. All 23 focused context tests pass, including section validation. Typed observation reads and the inspector UI remain open.

Context pages now include the latest normalized usage observation with source and receipt time, or explicit null when unavailable. All 24 focused context tests pass, including JSON serialization and explicit reported zero. UI schemas and inspector remain pending.

UI context protocol schemas now decode explicit snapshot absence, optional observations and separate last/total counters. TypeScript and the focused protocol test pass (1 test, 5 assertions). The inspector UI is not implemented or published.

The combined core/UI/context regression suite passed all 63 tests after observation reads. TypeScript and the context schema fixture also pass. Inspector implementation and its interaction acceptance remain pending; no activation or restart.

A first ContextScreen component has been drafted and typechecks, but is not wired to App or published. It currently reads paginated raw sections and reports token availability; historical selection, request cancellation, loading/error states and preserved chat interaction still need acceptance tests. This is work in progress, not a completed inspector.

The draft inspector pins the resolved latest call in a ref, avoiding a duplicate initial request caused by updating selection state. TypeScript passes; App integration and interaction tests remain pending.

The draft screen distinguishes loading, request failure and snapshot absence, and clears stale section content while loading. TypeScript passes. It remains unwired and unpublished; interaction tests, cancellation and historical selection are pending.

The draft screen interrupts its owned request fiber on section change/unmount and ignores stale results. TypeScript passes; full Bun rerun passed 23 tests/208 assertions after an earlier shortcut timing failure (focused rerun also passed). The screen remains unwired/unpublished; production mounting, historical selection and preserved return-state acceptance remain open.

/context is now wired through the shared command registry to the draft screen. Escape returns without issuing round cancellation; composer focus is restored after rendering. The production App mounting fixture passes at 80x24, and TypeScript plus the full Bun suite pass (24 tests, 212 assertions). Historical selection, full state-preservation coverage, observer refresh, user-friendly sections and publication remain pending. This is not completion of TODO 1.

Pending context reads now have a five-second timeout and are interrupted on exit; the 60x24 mounting fixture exposed overlapping shrinking header rows, fixed by non-shrinking wrapped text. Both screen fixtures pass; TypeScript and all 25 Bun tests/213 assertions pass. Historical selection, full return-state preservation, observation refresh and publication remain open.

The draft inspector also shows the reported context limit in tokens and observation receipt time. TypeScript and all 25 Bun tests/213 assertions pass. It has not been published or activated; historical selection, complete return-state acceptance and readable request sections remain pending.

The production-mounted section fixture verifies that switching sections pins the original call rather than following current memory. TypeScript and the full Bun suite pass (26 tests, 214 assertions). Historical selection, full return-state coverage, readable sections and activation remain pending.

The tracked request join now finalizes its owned fiber on client shutdown as well as screen cleanup. TypeScript and all 26 Bun tests/214 assertions pass. Historical selection and complete inspector acceptance remain pending; no publication or running-server changes.

Historical call navigation is drafted using a bounded call list and Up/Down selection. Both list and page requests own cancellable fibers. The pending-read fixture now waits for both operations to start before Escape; TypeScript and the full Bun suite pass (26 tests, 215 assertions). Historical navigation itself still needs a dedicated fixture; list failures are currently hidden and must be surfaced. Full return-state preservation, readable sections, observation refresh and activation remain pending.

### TODO 1.12 — isolate UI side effects (design discussion pending)

User direction: treat direct React useEffect usage as a candidate for complete removal. If lifecycle effects remain necessary, encapsulate them behind a clearly defined custom hook, controller or context interface; presentation components must not own transport orchestration. This is a design requirement to investigate, not an approved refactor.

ContextScreen currently uses two effects: one loads the bounded historical call list on mount; the other loads the selected snapshot section/page when call, section or offset changes. They coordinate loading/error state, schema decoding, five-second timeouts, request cancellation on replacement/unmount, and suppression of stale results. These requirements must survive any redesign; removing the hook alone does not eliminate the underlying side effects.

- [ ] Compare an Effect/Atom-owned context controller with a dedicated context-data hook or provider.
- [ ] Define a typed interface for selection, paging, read state, errors and cancellation, separate from rendering.
- [ ] Discuss the design before implementation; prefer no direct useEffect in ContextScreen, and explicitly justify and isolate any remaining lifecycle bridge.
- [ ] Test request identity, cancellation, stale-response rejection and return-state preservation through observable events rather than request-array positions or transient loading frames.

### TODO 1.12 implementation update
Do not use React useEffect without a serious, explicitly documented justification. Isolate asynchronous side effects in Effect Atom controllers rather than presentation components. ContextScreen now uses an Effect Atom controller for selection, call listing and page reads; it contains no direct useEffect. Registry disposal owns interruption and dependency changes invalidate reads. A finite 50 ms idle TTL prevents disposal between React snapshot reads and subscription; registry sweep resolution can delay unmount interruption, so prompt cancellation still requires acceptance. TypeScript and four focused screen tests pass (8 assertions). Full regression and remaining TODO 1 acceptance are pending. No publication or restart.

Effect Atom refactor regression: TypeScript and all 27 Bun tests pass (218 assertions). The bundle fixture now checks specifically for duplicated host state (state.ts, messagesAtom and statusAtom), rather than forbidding screen-local Atom constructors. ContextScreen has no direct useEffect; existing useEffect elsewhere has not been removed. Prompt unmount cancellation, complete return-state preservation, readable sections, observation refresh and publication remain pending. No restart or activation.

The controller now exposes explicit cancellation for Escape, interrupting both owned reads immediately instead of waiting for registry eviction. Other unmount paths still use registry cleanup and need dedicated acceptance. TypeScript and all 27 Bun tests pass (218 assertions); focused screen/bundle tests pass (5 tests, 16 assertions). Direct useEffect remains absent from ContextScreen; existing effects elsewhere are not yet audited. TODO 1 remains in progress: complete return-state preservation, readable sections, observation refresh, and publication. No activation, restart, or commit.

The Atom controller retains the first resolved snapshot ID independently of rendered page state, including while a replacement section is loading. TypeScript and all 27 Bun tests pass (218 assertions; process-462). No publication or activation. Next acceptance work remains stale-response/cancellation fixtures, complete return-state preservation, readable request sections and observation refresh.

Controller replacement acceptance: the registry-mounted fixture verifies that changing selection interrupts the previous payload read, starts provenance once, and explicit cancellation interrupts the replacement. Escape acceptance now requires both list and page reads to finalize. TypeScript and all 28 Bun tests pass (223 assertions; process-472). Full return-state preservation, stale-result acceptance, readable sections, observation refresh, non-Escape unmount cancellation and publication remain pending. No activation, restart or commit.

### TODO 1 acceptance update

Controller fixtures now verify replacement interruption, disposal after the last subscriber leaves, and rejection of late completion from an obsolete selection. TypeScript and the full Bun suite passed: 30 tests, 230 assertions (process-481).

Unmount disposal is not immediate: AtomRegistry's default 1,000 ms timeout resolution rounds the 50 ms idle TTL into disposal buckets, so observed cleanup can take nearly two seconds. Escape explicitly interrupts reads and does not wait for idle disposal. Do not describe the idle TTL as a 50 ms cancellation guarantee.

Still pending: complete chat return-state acceptance, readable request sections, observation refresh, and publication/activation. TODO 1 remains incomplete; no server restart or commit.

Return-state fixture verifies that a draft edited while the inspector is open retains text, cursor and selection after Escape, composer focus returns, and no send is queued. TypeScript and full Bun regression passed: 31 tests, 235 assertions (process-487). This does not yet establish history-scroll preservation or preservation of a draft across command entry; those remain separate acceptance cases. No publication, activation, restart or commit.

Observation refresh: R refreshes the call list and the selected snapshot through Atom refresh callbacks, without useEffect or changing the immutable captured payload. Controller acceptance verifies refresh stays pinned to the resolved snapshot ID. TypeScript and full Bun regression passed: 32 tests, 238 assertions (process-493). Manual refresh is implemented; automatic observation refresh is not claimed. Remaining TODO 1 work includes readable request sections, history-scroll return acceptance, and publication/activation. No server restart or commit.

Publication guard alignment: publish.ts now permits screen-local Atom constructors while rejecting duplicated host state and chart registration, matching the isolated bundle fixture. TypeScript and full Bun regression passed: 32 tests, 238 assertions (process-500). This is preparation only: no view has been published or activated. Remaining TODO 1 acceptance includes history-scroll return preservation and readable request sections.

History return acceptance: the production-mounted App fixture loads 100 messages, scrolls history to row 12, opens /context, and verifies the restored history remains at row 12 after Escape. TypeScript and the full Bun suite passed: 33 tests, 240 assertions (process-504). Draft/cursor/selection, focus, history scroll, replacement interruption, stale completion, and manual refresh now have fixtures. Readable request sections and publication/activation remain pending; TODO 1 is not complete. No restart or commit.

Inspector presentation update: selected section and offset are visible; exact Lisp pages use the existing lexical Expression highlighter without parsing or rewriting snapshot data. TypeScript and full Bun regression passed: 33 tests, 240 assertions (process-510). This improves inspection readability but is not a structured request-section viewer. Publication/activation and structured readability acceptance remain pending.

Latest backend regression: context/core/UI ERT passed 63/63 (process-512); latest frontend regression passed TypeScript and 33 Bun tests / 240 assertions. No activation or publication has occurred. Preserve missing historical snapshots as unavailable.

Publication acceptance: view-1791591350491-b3e63b55-7707-4bd5-9351-16507efd6b4d.mjs was published after TypeScript, 33 Bun tests / 240 assertions, and 60x24 / 120x40 smoke checks passed. Running UI host PID 2342043 acknowledged committed activation at 2026-10-10T00:15:51.217Z. This confirms view activation, not loading of changed Lisp definitions or end-to-end context capture. Backend runtime acceptance and structured request-section readability remain pending; TODO 1 is not complete. No server restart or git commit.

Hot migration acceptance: loaded context/store/Codex/model/chat/UI definitions in the running Lisp host without restarting either server. Context metadata now lives in weak identity-keyed side tables, preserving existing chat (23 slots), connection (10 slots), and run (14 slots) layouts and process identities. Existing active-round continuation is temporarily wrapped to supply its session store; unavailable pre-migration provenance is explicitly labeled, not reconstructed.

Runtime checks observed new immutable request snapshots, terminal tool-boundary outcomes, submission evidence, paginated payload reads, and reported usage (input 66476, cached input 62464, output 63, context limit 258400). These counters remain provider reports, not proof of context occupancy or model incorporation. Reentrant summary dispatch initially inherited the request observer and produced orphan captures; observer binding is now disabled while pumping unrelated callbacks. The 28 orphan entries were marked migration-incomplete with explicit evidence rather than fabricated outcomes. Subsequent observed snapshots terminate normally. Context/core/UI ERT passed 63/63 after this fix (process-532); targeted diff check passed (process-536). UI activation was previously acknowledged by PID 2342043. Structured request-section presentation remains open; TODO 1 is not declared complete. No restart or git commit.

Migration regression acceptance: the request-boundary fixture now asserts that unrelated pump callbacks cannot inherit the capture observer. A side-table fixture verifies stable 23/10/14-slot chat/connection/run layouts and metadata identity. Combined context/core/UI ERT passed 64/64 (process-540); targeted diff check passed (process-541). Backend hot migration and real snapshot/usage reads are accepted; structured request-section presentation remains the remaining TODO 1 gap.

### Deterministic time correction

Tests must synchronize on explicit events or controlled scheduler progress, never arbitrary pauses or wall-clock polling. Test timeouts by advancing an injected clock, not waiting real seconds. Keep wall-clock reads at adapter boundaries. Context reads now inherit their parent fiber runtime; cancellation returns a completion promise. TypeScript and five focused controller/time tests passed. Virtual TestClock covers the five-second timeout and finalization. UI acceptance remains unresolved: the latest combined focused run had three failures (exit/focus, section navigation, history scroll). AtomRegistry idle TTL uses internal wall-clock timers, not Effect TestClock. The cancellation test now explicitly tests cancellation, not unsubscribe-only disposal.

Deterministic correction progress: context UI tests removed Date.now polling, real sleeps, and setImmediate pauses. Keyboard state transitions commit with flushSync; renderer progress is driven explicitly. History scroll is captured before opening the inspector rather than relying solely on unmount cleanup. TypeScript and full Bun regression passed: 34 tests, 235 assertions (process-46). This does not prove all timing is deterministic: production history restoration still polls timers, AtomRegistry TTL still uses wall time, and unrelated tests retain real-time waits. Controller timeout is covered with injected TestClock. No publication of these corrections yet.

Context controller idle TTL is now zero: its read atoms no longer enter AtomRegistry wall-clock TTL buckets. TypeScript and focused context tests passed (11 tests, 25 assertions); full Bun passed (34 tests, 235 assertions, process-58). Remaining deterministic-work gaps are production history timer polling, unrelated real-time tests, and explicit lifecycle signals in controller tests (atom subscription is not a general readiness signal). Corrections remain unpublished.

History restoration now observes renderer frame/layout readiness instead of polling with a 10 ms interval and a one-second deadline. The listener is removed after restoration or unmount. Focused context/remount tests passed (7 tests, 37 assertions); TypeScript and full Bun passed (34 tests, 235 assertions, process-78). Context lifecycle tests use explicit start/finalization signals. Remaining work: other autoscroll timers, unrelated real-time tests, unsubscribe-only acceptance, and publication. Do not treat passing regressions as proof of globally deterministic scheduling.

Timing correction progress: clipboard publication now follows renderer frames, with listener cleanup, rather than a zero-delay timer. Memory-map selected-block scrolling follows renderer frames instead of interval retries. Tool-card and clipboard tests no longer sleep; memory-map acceptance uses controlled renderer progress and synchronous keyboard commits. Rapid repeated clicks trigger OpenTUI word selection, so the tool-card test uses distinct click positions instead of sleeping past the multi-click threshold. TypeScript and full Bun suite passed (34 tests, 226 assertions). Remaining work includes shortcut expiry virtual time, session tests, external socket/publication synchronization, and conversation autoscroll timers. No tests removed; changes not published.

Further timing correction: conversation autoscroll now uses renderer frame events rather than 30 ms/10 ms timers. Session/remount and input-history tests use renderer readiness and synchronous keyboard commits instead of wall-clock polling and sleeps. Initial scroll assignment waits for actual overflow layout. Shortcut navigation polling was replaced with renderer progress; Ctrl+C expiry still requires virtual-time conversion. Latest TypeScript/full Bun passed (34 tests, 194 assertions, process-35); no tests removed. Remaining elapsed-time test waits: Ctrl+C expiry, external socket/live-publication acknowledgement helpers, and client fragmentation setImmediate. Changes remain unpublished; this is not completion of deterministic-testing work.
Socket acceptance now synchronizes on explicit server request-received signals instead of elapsed-time polling. Renderer readiness handles UI acknowledgement display. TypeScript/full Bun passed (process-41: 34 tests, 194 assertions). Remaining timing conversions: Ctrl+C expiry, live-publication acknowledgement polling, and transport fragmentation setImmediate. No tests deleted; changes unpublished.
Ctrl+C confirmation expiry now uses an Effect fiber and injectable Clock rather than Date.now/setTimeout. Its UI test advances TestClock by one second, without sleeping; expiry requests a renderer update. Pending expiry is interrupted on disarm/unmount. TypeScript and full Bun passed (process-71: 34 tests, 194 assertions). Still open: live-boundary acknowledgement polling and client fragmentation setImmediate; changes unpublished.
Transport fragmentation test now chains the second write from the first write completion callback instead of setImmediate. TypeScript/full Bun passed (process-75: 34 tests, 194 assertions). Live-boundary elapsed-time acknowledgement polling remains open; changes unpublished.
Live-publication tests now await acknowledgement-write completion via onAcknowledged instead of polling the acknowledgement file. No direct Date.now/performance.now/sleep/timer calls remain in active UI test sources. However, the bounded renderer-pass helper still retries real filesystem/import work; this is not fully deterministic external-I/O ordering. Next correction: make publication checks await the in-flight check and drive React commits explicitly, replacing that retry helper. Latest TypeScript/full Bun passed (process-90: 34 tests, 194 assertions). Changes unpublished; no tests removed.
Live-publication ordering correction: concurrent checks share an in-flight completion Promise. Tests await actual check completion, explicit React commits, renderer readiness, and acknowledgement-write signals; the external retry helper is removed. Publication checks request a renderer update after completion. TypeScript/full Bun passed (process-99: 34 tests, 194 assertions). No tests removed. Changes remain unpublished; production publication polling is still an external-boundary timer, not a claim of globally deterministic execution.
Deterministic-test regression acceptance: repeated suites exposed remaining React commit/readiness races in publication rejection, Ctrl+C expiry, session reports, and shortcut focus. Those transitions now commit explicitly or await lifecycle/focus evidence rather than arbitrary pauses. Latest TypeScript/full Bun passed (process-135); three consecutive full Bun runs passed (process-136), each 34 tests/194 assertions. Active UI test sources contain no direct wall-clock polling or sleep calls. Real socket/filesystem integration still uses real I/O; this is not a claim that all external scheduling is virtualized. No tests deleted. Changes not yet published.

### Hot replacement removed

Igor approved removing UI hot replacement. The entrypoint now mounts App directly; revision polling, candidate imports, rollback, publication and activation acknowledgements are removed, along with their implementation-specific tests. Client changes require relaunching only the TUI, not the Lisp server. Existing running clients remain unchanged until relaunched. Historical publication notes above describe the previous architecture.

TypeScript and the remaining Bun suite passed: 30 tests, 138 assertions. A tool-card fixture explicitly clears selection before the second click, preserving the selection guard without waiting for the multi-click timeout. Full diff checking found pre-existing trailing whitespace in ui/artifacts/snapshot-120.txt; that artifact was preserved. Timing-boundary work and structured request-section readability remain open; TODO 1 is not complete.

### Boundary correction acceptance

Activity is now a pure, static work indicator driven by authoritative streaming state, with no component animation timer. Ctrl+C expiry is isolated in `time-boundary.ts`, cancellable and clock-injectable; its existing acceptance test advances TestClock. Renderer frame/selection subscriptions remain UI-adapter lifecycle effects, not domain clocks. Lisp socket transport and polling remain external adapters. TypeScript passed; three consecutive Bun runs passed (30 tests, 138 assertions each); combined core/UI/context ERT passed 69/69. Structured request readability remains unfinished: exact paginated Lisp is available, but it is not yet a structured inspector. TODO 1 remains open. No TUI/server restart or commit.

Request-field navigation increment: /context keys 4/5/6 select captured instructions, tools and turn input, projected by Lisp from the immutable request payload (not rebuilt from current memory). Raw payload/provenance/events remain accessible. Focused ERT passed 26/26 including projection fidelity; UI section selection stays pinned to the original snapshot (6 tests/17 assertions). Latest typecheck/full Bun passed 30 tests/139 assertions. Structured presentation and explicit missing-field semantics still require completion; these projections alone do not close TODO 1.

Field absence correction: projections distinguish a present empty field from an absent field. Absent fields show Captured field unavailable; legacy non-request payloads remain inspectable through raw payload. Focused context ERT passed 28/28. These field views still use exact Lisp representation; richer structured presentation remains open.
Instructions readability increment: captured instructions are paged as literal text with an explicit format field; raw payload remains unchanged and Lisp-highlighted. UI supports older responses without format. Latest TypeScript/Bun passed 30 tests/139 assertions; focused ERT passed 28/28. Structured tools/input presentation, full acceptance and live backend loading remain open. No relaunch or server restart performed.
Turn-input readability: textual captured input is projected as literal text; nontextual or empty vectors retain exact Lisp representation. Raw payload preserves original structure. Focused context ERT passed 30/30; TypeScript/full Bun passed 30 tests/139 assertions (process-111). Live loading and remaining TODO 1 acceptance are not complete.
Input fidelity correction: literal projection is limited to a single text item. Multiple items retain their exact Lisp structure, rather than inventing separators. Focused context ERT passed 31/31; latest TypeScript/Bun passed 30 tests/139 assertions. TODO 1 still requires final acceptance and live backend loading.
Latest acceptance evidence: narrow (60x24) literal-context rendering and return passed. TypeScript/full Bun passed 31 tests/141 assertions; combined core/UI/context ERT passed 75/75. Updated slopchat-ui functions were loaded into the live host without restarting the server. TUI remains on its old source until Igor relaunches it after work finishes. TODO 1 is not declared complete: tools still use exact Lisp presentation and final scope acceptance remains open.
Current implementation status: tools are pretty-printed by Lisp with lexical highlighting; instructions and single-text input are literal paginated views; raw payload remains authoritative. Unsubscription-only cancellation now has an explicit finalization-signal test. Latest typecheck/full Bun passed 32 tests/142 assertions; focused context ERT passed 32/32. Live UI protocol functions loaded without server restart. The TUI has not been relaunched. TODO 1 remains open where the checklist requires design/scope acceptance; do not interpret these checks as completion of TODOs 2–5.
Live bounded reads confirmed instructions and input as text pages (40 characters each; totals 5200 and 459736 respectively), without printing private payloads. This verifies the loaded backend projection, not the old running TUI. Remaining work includes the compact context indicator and final acceptance-matrix audit.
Compact indicator implemented as a pure projection of latest-call status metadata, using the shared observation projection. No extra polling or payload reads. It never borrows older usage; zero remains zero and absent remains unavailable. Narrow-width test exposed a clipped command; /context now comes first. TypeScript and full Bun passed 34 tests/147 assertions; combined ERT passed 78/78. Final acceptance-matrix audit remains open; this does not close TODO 1 or authorize TODO 2.
Acceptance audit found and repaired a gap: thread/start rejection previously lost its prepared request. Failed thread creation now retains only the parameters actually prepared, marks the snapshot failed, and re-raises the original error; no turn input is fabricated. Auth-rejection fixture passes. Focused context ERT passed 35/35; TypeScript passed. Final regression and remaining acceptance audit are pending.
Final regression after thread-rejection repair: combined core/UI/context ERT passed 79/79 (process-184); preceding 120-second run timed out and is not success. TypeScript/full Bun passed 34 tests/147 assertions (process-185). Updated model adapter loaded live without server restart. Remaining acceptance audit must explicitly cover queued preparation and compaction provenance; no completion claim yet.
Acceptance audit is still in progress: queue/compaction scheduler tests do not by themselves establish snapshot provenance through those transitions. A dedicated integration fixture is still needed; do not mark TODO 1 complete on their basis.
Queue preparation fixture now passes through the production start-input boundary and verifies input-first/prefix provenance and snapshot stability after current-view replacement. Initial fixture failed due to late require/setf expansion and an incorrect expectation that an already-built leaf would be overwritten; corrected without changing production. Focused context ERT passed 36/36. This fixture does not yet exercise an actual compaction transition.
Compaction acceptance fixture passed: a real merge changes the current view while historical captured text and prefix remain unchanged. Focused context ERT passed 37/37; latest TypeScript/full Bun passed 34 tests/147 assertions (process-209). Queue fixture exercises start-input preparation, not the full enqueue/dequeue lifecycle; that distinction remains part of the final audit.
Queue acceptance correction: the provenance fixture now enqueues input and drives the production pump/dequeue/start boundary, asserting the queue drains. Focused context ERT passed 37/37 (process-215); TypeScript/full Bun passed 34 tests/147 assertions (process-216). Final acceptance audit remains open; no completion claim.


### Payload-tail navigation and deferred inspector ideas

Entering payload (section 1), or selecting another call in payload, opens the final bounded 2,000-character page. Resolve and pin the saved snapshot ID first. Left/Right retain access to the unchanged full payload. Input (section 6) opens at the beginning. The tail need not contain every change.

Deferred ideas for discussion, not approved implementation:
- Call summary to details: a navigable call list with available metadata, then sections and full saved snapshots.
- Differences between calls: additions/removals/changes and a jump to the first difference between available immutable snapshots. Keep full raw access; never reconstruct missing data. Discuss noise and bounded comparison costs first.

### TODO 2 footer placement trial

Trial a fixed one-line memory status below the composer shortcut line, without inline expansion. Only Lisp-reported active/failed summary counts are shown. Idle means no reported summary jobs, not completion of all memory work. Missing status is unavailable. No animation, event history, publication claims, or persistence yet. Discuss placement with Igor before designing the event contract or a separate history screen.

### TODO 1 acceptance and telemetry audit — 2026-10-10

Igor accepted the current inspector UX after repeated opening, historical selection, pagination, section navigation and return-state checks. This closes the user-facing acceptance discussion for the current bounded inspector, not every deferred design item above.

Code audit: Codex thread/tokenUsage/updated supplies optional last and total counters and modelContextWindow. The adapter maps last.inputTokens to reported input, last.cachedInputTokens to reported cached input, and modelContextWindow to reported context limit; these are provider observations, not locally counted tokens. Usage is matched to thread/turn and the local snapshot, deduplicated, and may arrive after a tool boundary. The inspector projects the latest observation of the selected call; the footer uses the latest captured call only and never borrows older telemetry. Missing counters remain unavailable; zero is preserved. Total is not whole-chat accounting or live occupancy. Receipt time is local observation time.

Focused context ERT passed 37/37 on 2026-10-10. Previous TypeScript and Bun regression passed 36 tests/154 assertions for payload-tail navigation. This audit does not establish cached-input inclusion semantics, context/cache percentages, guaranteed notification delivery or a per-section token breakdown. Those remain deferred; no percentages are enabled.

Next discussion: choose the scope and method for a token breakdown of instructions, memory, tools and input. Provider telemetry currently supplies aggregate counters, not section counts. Exact counts require an applicable tokenizer/accounting contract; any local approximation must be explicitly labelled as an estimate, and component totals must not be presented as an exact decomposition of provider input. Memory is part of serialized input, so avoid double counting. Richer structured presentation and the broader design checklist remain open. No additional provider experiment, server restart or commit was performed for this audit.

### Compact token footer implementation

- The right side of the composer shortcut line shows latest-call reported input tokens and the reported context limit, compacted as `Memory · 128k / 258.4k`.
- These are reported input tokens, not a measurement of live context occupancy. Missing latest-call counters remain unavailable; older calls are never substituted.
- A renderer-owned rotating icon replaces the summarizing word only while Lisp reports active summary jobs; the count remains visible. Failures remain explicit.
- Extrapolation remains unavailable until a call-correlated baseline and a measured delta can be established. No character-count conversion is presented as provider usage. Cache percentage is deferred pending semantic validation.
- TUI restart only is needed for this UI change. Visual acceptance of animation and narrow-width placement remains open.

### Token estimates implementation checkpoint

Captured-call estimates are now exposed as optional metadata: instructions, tools and input, plus their sum. The initial heuristic is ceil(characters / 4) per captured section, not provider accounting. Memory is included in input. The footer marks the latest captured-call estimate with ~; the inspector displays the selected call breakdown separately from reported usage. Missing captured fields produce no estimate.

This is NOT the agreed next-call extrapolation yet: no future prepared request is available at the UI boundary, and no provider-calibrated delta has been implemented. Do not label the latest captured snapshot as the next request. Provider-calibrated extrapolation, model compatibility/invalidation, footer breakdown placement, and acceptance remain open. Cache percentage remains deferred.

Footer breakdown: I = instructions, T = tools, U = input; each estimate is marked ~. These describe the latest captured call, not the unprepared next call. TypeScript passed; Bun 39 tests/163 assertions; context ERT 38/38. Live loading and narrow-footer acceptance remain pending.

Context label correction: the footer total includes instructions, tools and input, not memory alone. Input exposes estimated memory and other-input subsets only when captured memory text matches the serialized request. Historical snapshots without this evidence stay unavailable. Subsets are not added to the total again. These remain captured-call characters/4 estimates, not next-call predictions or provider accounting. Narrow-footer acceptance remains open.

### Explicit reload and calibration checkpoint

Live explicit reload acknowledged committed for TUI PID 4151636; this is commit evidence, not a visual verification of draft/scroll retention. Boundary regression covers draft preservation and failed-render rollback.

Optional provider calibration now scales captured-section heuristics using an earlier call with identical thread/start configuration and an explicit model selection. Missing usage, zero baseline, unknown/default model, or changed configuration disables calibration; characters/4 remains the labelled fallback. This is a captured-call estimate, not a prediction of unseen next input. Current live calls omit an explicit model, so calibration is unavailable. Do not silently reuse a baseline from an unresolved default model. Next-call extrapolation remains unfinished until the actual prepared request and compatible resolved model evidence are available. Section allocation remains approximate, not provider accounting; no cache percentage is enabled.

Validation: context ERT 41/41; TypeScript passed; Bun 44 tests/174 assertions. Narrow footer work deferred at Igor's request.

### Before and after context display

The footer separates last reported provider input/limit from next approximate fresh-user-round tokens including the local draft. The next basis uses the current Lisp-rendered memory and the latest captured instructions/tools; characters/4 is a heuristic, not a prepared-request guarantee or provider accounting. It excludes future tool results and queued inputs, and is unavailable during active rounds or without a basis. Drafts stay local. Changed instructions/tools may invalidate the reused basis; resolved-model calibration is not applied to this prediction. Historical section estimates remain in /context.

Local /help toggles off on its second invocation and closes when a non-command message is submitted (including queue/steering). It is never submitted or journaled.

Validation: TypeScript passed; Bun 44 tests/181 assertions; context ERT 42/42. Explicit reload committed on TUI PID 4151636; visual acceptance remains unverified.


### Latest reported usage during work

The footer's `last` refers to the most recent retained call with reported input,
not necessarily the newest prepared call. Lisp supplies its explicit call ID and
observation as `lastReported`; this must never be attributed to the pending call.
The selected `/context` snapshot still shows only its own observations.
The next-round heuristic displays integer tokens so small draft changes are not
hidden by thousands rounding (approximately four characters per token).
Cache read and cache write are separate reported counters. Missing counters stay
unavailable and explicit zero stays zero. Cache percentage remains unavailable
until the app-server accounting contract is confirmed; API documentation alone
is not proof of that transport contract.

### Session cumulative memory-work token accounting

Implementation approved on 2026-10-10. Accounting begins at activation; earlier session work is not reconstructed. Late observations are accepted for up to 30 seconds, with at most 100 retained routes; eviction preserves subtotals and coverage. Persistence and cache shares remain deferred.

- Show a cumulative memory-work usage block in /context, separate from conversation usage and from estimates of memory text included in a normal prompt.
- Initial proposed scope: the current Lisp chat session. Persistence across server restarts requires a separate decision; never imply historical completeness.
- Account for every compaction/summary provider attempt, including shortening retries and failed or cancelled attempts when usage is reported. A successful memory node is not the accounting unit.
- Attribute observations by chat, job, attempt, provider thread and turn. Replace each attempt's previous observation with its latest counters; duplicate or late notifications must not increase the sum twice.
- Sum reported input and output separately. Total may be shown only under a validated provider accounting contract; reasoning output must not be added again when it is an output subset.
- Missing telemetry is not zero. Show known subtotals and coverage (observed attempts / started attempts), with an explicit incomplete indicator. Estimates must remain separate from reported sums.
- Keep a bounded accounting ledger independent of evictable request snapshots so inspector retention does not silently reduce accumulated totals. Define late-update retention and reset scope before implementation.
- Current summary runs carry compaction purpose but do not use the ordinary captured-call usage path; existing context totals cannot establish memory-work expenditure.
- Future memory-work cache read/write counters and validated cache-read share are deferred. Do not infer financial savings or subscription billing.

Official OpenAI prompt-caching documentation defines API cache-hit share as cached input / input; cached and cache-write input are included in API input accounting. The app-server documentation and generated field names do not yet establish the same contract for installed Codex subscription telemetry. Continue showing raw reported cache counters without a percentage until that mapping is established.

### Next planned work — 2026-10-11

Igor requested recording this plan before implementation. Defer the memory-quality and temporary-chat reopen audit for now.

The mini-bar's cumulative memory-work input is gross reported input across summary attempts, including shortening retries; it does not subtract reported cached input. Thus a value such as two million is accumulated token processing, not current context size, uncached input, or billed expenditure. Legacy totals must remain separately identified: cache telemetry was not collected for that earlier accounting period, so its uncached subtotal is unavailable.

Next UI task: expose memory-work cache telemetry in the existing compact mini-bar, using the session ledger as the single source. Show gross input, reported cached input, and output; show cache-observation coverage or partial/unavailable when needed. Derive uncached input only for observations with both valid input and cached-input counters, never by subtracting a partially covered cache subtotal from all input. Keep legacy totals separate. Raw telemetry does not establish billed savings. Confirm the installed transport accounting contract before enabling a cache percentage. Preserve the existing one-line layout and missing-versus-zero behavior; test complete, partial, zero, and legacy-only data. This entry records the next task, not an implemented UI change or a delivery date.

### Memory-work cache split implemented — 2026-10-11

The mini-bar displays session memory-work new / cached / out token subtotals. New is reported input minus reported cached input, not billed cost. It is available only when input and cache coverage include every started attempt and cached input does not exceed input. Otherwise new is unavailable; observed subtotals remain visible with partial coverage. Zero is preserved. Legacy totals are excluded from this split and remain separately visible in the inspector. No cache percentage or monetary savings is inferred. Source checks passed; runtime activation has not been verified.


### Summary source-boundary acceptance — 2026-10-11

A supplied outer result must remain distinguishable from quoted historical requests, missing results, explicitly empty collections and pending summaries. Outer author labels remain authoritative at leaves and merges. Clipped tool output has unknown total/completeness; nested sample counts must not become its total. Task-local metadata may describe these source boundaries without altering canonical source or shared provider instructions/tools. Boundary validation is a bounded structural check, not proof of full semantic fidelity.

Implementation and evidence: `docs/memory-summary-fidelity.md`. Rejected responses remain observable as source-boundary validation events and their provider attempts remain in cumulative memory-work usage. Only valid candidates may be retained; the existing five-attempt limit remains, with a visible failed job on validation exhaustion. Original messages and committed tree nodes stay immutable; identified historical errors are superseded by a normal append-only correction note.

Final acceptance receipt: isolated ERT 149/149; production replay and source-only request probe passed; TypeScript and Bun passed (52 tests, 207 assertions). Nil summaries are labelled unavailable without inferring active jobs. Equivalent empty-only replies are normalized from an empty-only source. Omitting a low-value acknowledgement does not require retaining its author tag; invented authors remain rejected. A forbidden summary tool attempt is an inference failure and retries as data within the existing cap; its denial cannot become a source fact. Raw validation responses and normalization are inspectable. Narrow activation preserved live server/ledger/agent/instructions/tools; corrections use normal append notes 7279 and 7288. Broad semantic quality remains unproven beyond these regressions.

# Independent Ouro threads with shared project memory

Status: proposed extension. Multiple user threads are not implemented yet.

## Goal

A project can contain several independent conversations with Ouro and execute
work in parallel. Each thread has its own executor and active work, while the
project's persistent memory is shared. A decision made in one thread is available
to other threads through that memory.

Example: an architecture thread discusses a protocol, a UI thread implements
its interface, and an experiments thread measures performance. The user switches
between them in one TUI.

## Terms

- **Project**: a workspace containing threads and their shared persistent memory.
- **Thread**: an independent conversation with a stable ID, its own user turns,
  and an Ouro executor. Renaming a thread does not change its identity.
- **Thread executor**: a Lisp agent that owns its self-modifying loop, tools,
  and execution-local history.
- **Shared memory**: the project's event journal and its summary tree.
- **Thread memory view**: the context selected from shared memory for one executor.
- **Memory snapshot**: a consistent view with a visibility boundary expressed
  as a global event ID.

A user conversation thread differs from a technical model thread. Codex remains
an adapter: a model response may use a new ephemeral session without changing
the user thread's identity.

## State boundaries

The persistent journal, summary tree, and published work results are shared
within the project. Each thread owns its message sequence, task queue, active
turn, steering inputs, executor state, and memory view.

Draft text, cursor, focus, scroll position, and selected memory node belong
to a TUI tab. Switching tabs does not transfer this state to another thread.

An independent conversation means independent execution and presentation.
Thread contents remain accessible through shared project memory. Execution
isolation alone does not make a conversation private.

## Architecture

```text
TUI: thread tabs
  ├─ UI           → Ouro executor A
  ├─ architecture → Ouro executor B
  └─ experiments  → Ouro executor C
                          |
                 single memory owner
                          |
               shared journal + summary tree
```

The recommended initial implementation uses a separate Emacs process per thread
and a separate project memory service. This isolates Lisp function redefinition,
variables, and executor failures. Each Ouro retains the original model: it
creates and develops its own agent loop. Codex and the TUI do not take ownership
of execution.

The memory service is the only writer of memory files. Executors submit events
and receive acknowledgements, snapshots, and read results. They do not open one
memory directory as multiple independent writers.

## Journal and summarization

1. Each record has a globally increasing `eventId`, a `threadId`, an event kind,
   and a timestamp. Execution events also reference a `turnId`. User requests
   have an ID for correlating acceptance and results.
2. The shared journal is the source of truth. A thread's history is a projection
   of records carrying its `threadId`. Indexes and local caches are rebuildable.
3. Message acceptance is acknowledged after durable storage and before model
   execution begins.
4. The memory owner serializes journal writes and tree-node publication.
   Summarization jobs may run concurrently under a bounded concurrency limit.
5. Preserve the binary summary tree, immutable published nodes, bounded context,
   and zoom/date access to source data. Node ranges use global IDs rather than
   positions in a thread's history projection.
6. Clearly identify the unsummarized tail and unfinished turns. A completed
   action, an error, and an agent's intention must remain distinguishable.

Summaries spanning multiple threads preserve the provenance of significant
information. The interface can filter a thread's conversation and separately
inspect shared memory.

## Context acquisition

At the start of a user turn, the executor receives a shared-memory snapshot.
Its context includes its own prior conversation and relevant information from
other threads within the configured context budget. Sharing memory does not
require inserting every concurrent message into every model request.

Execution-local history remains owned by the Lisp agent. A turn does not receive
silently changing context between model calls.

During a long-running turn, the agent may explicitly refresh its snapshot and
read new information. A refresh returns a new visibility boundary; the read
result enters execution-local history. Context assembly must prevent duplicate
inclusion of events already represented in that context.

If thread A publishes a decision after a turn in thread B has begun, B sees it
on an explicit memory refresh or on its next user turn. Reading another thread's
message does not steer B's active task.

## Execution and routing

- A thread runs one user turn at a time. New input during execution steers that
  turn according to the existing rules.
- Different threads may execute concurrently. The project has shared limits
  for active user executions and summarization jobs.
- Requests, acknowledgements, results, errors, and state events target a specific
  thread and turn. Switching tabs does not change an already submitted request's
  destination or clear another tab's draft.
- An executor failure does not stop other threads or the memory service.
  Interrupted turns are marked; tools are not automatically replayed on recovery.
- A client disconnect does not prove that a send failed. The client resynchronizes
  from the journal and does not automatically repeat an unknown-outcome send.

## TUI

### Turn completion and notifications

An explicit executor event determines completion. A pause, completion of one
model request, message acceptance, or the absence of active summarization does
not establish that the user turn has finished.

Turn states are `queued`, `running`, `completed`, `failed`, and `cancelled`.
After the final response and termination of the agent loop, the executor
publishes `turn.completed` with `threadId`, `turnId`, and a reference to the final
response. Errors and cancellations publish their corresponding terminal events.
The memory owner stores the event durably before notifying clients.

A terminal state is immutable. Only one terminal event is recorded for a turn;
redelivery does not create duplicate completion notifications in the interface.
A completed turn may leave background summarization jobs running.

The TUI displays state in each tab and highlights unread completion in inactive
threads. A subscription or polling request returns events after the client's
known `eventId`; reconnecting recovers missed completions from the journal.
A state snapshot includes the latest turn and its status.

`accepted` means only that the user message has been stored. It allows the
composer to clear, but does not replace `turn.completed`, `turn.failed`, or
`turn.cancelled`.

### Tabs and history

The TUI supports creating and renaming threads, switching tabs, and viewing
activity and unread results. A new tab opens a new thread in the same project.

The selected thread's history and shared memory are presented separately.
Information from another thread has visible provenance and links to its source.
Closing the TUI leaves executors running. Reconnecting restores the thread list,
histories, and execution states.

## Concurrent code changes

Shared memory coordinates decisions but does not resolve file conflicts.
For parallel development, use a separate Git worktree per thread and explicitly
integrate changes. Threads retain shared project memory even when their code
worktrees differ.

If threads use the same checkout, coordinate overlapping file changes separately.
Do not overwrite another thread's unfinished edits.

## Compatibility

The existing single-conversation chat becomes the project's `main` thread.
Its records acquire `main` provenance while retaining original IDs, timestamps,
and tree-node ranges. Migration does not replay tools or unnecessarily
resummarize the entire history.

The legacy client continues to address `main`. The new protocol explicitly
selects a project and thread. Directory-based chat identity remains a compatible
way to select a project and its main thread.

## Acceptance criteria

1. Two threads execute different tasks concurrently and receive their own
   responses, steering inputs, and errors.
2. A decision from thread A is available to thread B through a newer shared-memory
   view, with identifiable provenance.
3. Concurrent writes do not produce duplicate IDs, lost messages, or corrupted
   tree nodes. Each thread's history remains ordered.
4. A turn's memory snapshot changes only through an explicit refresh.
5. An executor failure preserves the journal and does not interrupt other threads.
6. Tab switching preserves drafts and request destinations. A late acknowledgement
   belongs to the original tab.
7. Reconnecting restores histories and active states without replaying tools
   or automatically repeating unknown-outcome sends.
8. The existing chat migrates to `main` without losing IDs or data, and the legacy
   client remains functional.
9. Each executor remains an independent Ouro. Shared memory neither replaces
   its agent loop nor transfers execution ownership to the model adapter.
10. Clients distinguish message acceptance, execution, and terminal turn state.
    Completion in another thread is visible without switching tabs, and missed
    notifications are recovered after reconnecting.

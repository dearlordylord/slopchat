# OpenCode 2 process waiting

Inspected branch `2.0`, revision `7a6ce05d0939826aa6c8e1c481489a713b2d633f`. Scope: built-in bash, task, and session prompt loop; not plugins or every scheduler.

## Findings

- `packages/opencode/src/tool/bash.ts`: the tool stays pending while an Effect races process exit, abort, and timeout. Default timeout is 120000 ms, overridable by input or experimental flag. Abort/timeout kills the process (force kill after 3 seconds). Output streams into tool metadata for UI progress. No process session ID or write_stdin polling API in this tool.
- `packages/opencode/src/tool/task.ts`: task_id resumes a child agent session, not a shell process. The tool awaits the child prompt result; it is not a detached completion-triggered parent turn.
- `packages/opencode/src/session/prompt.ts`: the model loop continues for tool calls; exits after a finished assistant response without tool calls. These paths do not demonstrate automatic wake-up after the final response.

## Implication for SlopChat

Keep a turn active and await bounded process results, or poll an existing process ID. Automatic continuation after a final response requires a separate scheduler/event policy; the inspected OpenCode paths are not evidence for one.

## Primary sources

https://github.com/anomalyco/opencode/blob/7a6ce05d0939826aa6c8e1c481489a713b2d633f/packages/opencode/src/tool/bash.ts
https://github.com/anomalyco/opencode/blob/7a6ce05d0939826aa6c8e1c481489a713b2d633f/packages/opencode/src/tool/task.ts
https://github.com/anomalyco/opencode/blob/7a6ce05d0939826aa6c8e1c481489a713b2d633f/packages/opencode/src/session/prompt.ts

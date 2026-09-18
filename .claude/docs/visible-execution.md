# Visible execution

Use this procedure for long-running commands and sequences of awaited checks,
as directed by `rules/harness-runtime.md`. It applies to every host in Orca.
This does not authorize another model worker or expand the task's permissions.

## Start and observe

1. Load `orca-cli` and its guide from the installed executable. Create a terminal
   in the current workspace, titled `Ejecución - <task>`, without changing focus.
   Confirm its returned surface is visible. If only a background handle is
   available, report that limit. Address this run by its explicit terminal handle.
2. Show a unique run ID, cwd, actual revision (including dirty state), exact
   command, and start time. Stream stdout and stderr; capture each command's
   exit code immediately and print an explicit completion marker for that run.
   Keep the shell open. Its running state does not establish its child's state;
   do not use a wait for shell exit as evidence that the command completed.
3. Read new output with the handle and cursor every 30 seconds while waiting.
   Follow cursor pagination when output is limited. Report meaningful progress
   in the chat at least once a minute. A silent process or an expired wait means
   pending evidence, never success or permission to rerun.
4. Stay engaged until completion, failure, a blocker requiring user input, or
   cancellation. Report the observed result and any checks that did not run
   before ending the turn. Leave the terminal open for the user to inspect.

## Resume and limits

After an interruption, re-list terminals if the handle is stale and inspect the
existing run before sending more input. Recover its run ID, command, output and
completion marker; do not repeat a command on silence or an ambiguous send receipt.
Use the CLI's current recovery contract for that receipt. Missing or discarded
output means unverified; it does not justify rerunning a potentially mutating job.

Chat updates require active supervision. Do not promise an automatic notification
after the conversation stops, or retention across an Orca restart without evidence.
If Orca is unavailable, report that limit and retain the host's native process
handle and output for supervision in this conversation. Never require closing it.

For a review pinned to a commit, label that revision explicitly. Checks against
the current checkout do not verify an earlier revision. Keep any historical
snapshot unchanged; report unsupported checks as unverified.

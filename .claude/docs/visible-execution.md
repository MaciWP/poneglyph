# Visible execution

Use this procedure for long-running commands and sequences of awaited checks,
as directed by CLAUDE.md §How to work. It does not authorize another model
worker or expand the task's permissions.

## Start and observe

1. Start the command with the host's native background handle (Claude Code:
   Bash `run_in_background`, then `Monitor` or the completion notice). If the host
   has none, run it in the foreground with a timeout that covers it.
2. Show the cwd, actual revision (including dirty state), exact command and start
   time. Capture each command's exit code immediately and print an explicit
   completion marker. A running shell does not establish its child's state.
3. Read new output while waiting and report meaningful progress in the chat at
   least once a minute. A silent process or an expired wait means pending
   evidence, never success or permission to rerun.
4. Stay engaged until completion, failure, a blocker requiring user input, or
   cancellation. Report the observed result and any checks that did not run
   before ending the turn.

## Resume and limits

After an interruption, inspect the existing run before sending more input. Do not
repeat a command on silence or an ambiguous result. Missing or discarded output
means unverified; it does not justify rerunning a potentially mutating job.

Chat updates require active supervision. Do not promise an automatic
notification after the conversation stops.

For a review pinned to a commit, label that revision explicitly. Checks against
the current checkout do not verify an earlier revision. Keep any historical
snapshot unchanged; report unsupported checks as unverified.

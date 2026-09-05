---
name: validate-block
description: Judge whether a proposed "Blocked" on a task is a TRUE blocker or a premature bail. Every orch agent skill MUST consult this before setting a task to Blocked and obey the verdict. Invoked as `/validate-block <issue-url> "<reason>"`.
---

<goal>Given a task and a proposed block reason, decide if blocking is legitimate. If not, name the concrete next action so the agent CONTINUES instead of bailing.</goal>

<rules>
<rule id="taxonomy">A block is LEGITIMATE only if the reason matches one of:
- **user-only credential / auth** needed (2FA, password, OAuth re-auth, a secret or token you do not have);
- **destructive op with no safe default** (history rewrite on a shared branch, deleting non-scratch data);
- **a real external wall hit AFTER a genuine attempt** (the preview never reaches Ready; the build cannot be made to pass after honest fixes; a dependency that must publish first). A predicted wall is not a hit wall.
- **irreducible ambiguity** that could flip the task outcome wholesale (no defensible default exists).
Everything else is NOT a blocker: soft uncertainty (naming, styling, whether to add tests), "this seems hard", a merge conflict that can be resolved, a review comment that can be addressed, a flaky check that can be retried. **Default to NOT-legitimate when unsure.**</rule>
<rule id="evidence">For any "external wall" claim, require evidence of a real attempt (a logged failure, the actual error). No attempt means not legitimate.</rule>
<rule id="output">Return exactly:
`legitimate: true|false`
`reason: <one line>`
and when false: `what_to_try: <the concrete next action to take instead of blocking>`.</rule>
</rules>

<steps>
1. Read the issue and the proposed block reason from the prompt.
2. Match against `taxonomy`; apply `evidence` to any wall claim.
3. Emit the verdict per `output`. The calling skill obeys it: `false` means do `what_to_try` and continue; `true` means add the `blocked` label (the task stays in its current state so the human sees where it stuck).
</steps>

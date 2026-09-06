---
name: verify-code
description: Independently verify ONE Verifying code task (preview-test on its live deployment, then a cold PR review) and route it binary. change requests -> Pending, clean -> Verified. Fresh agent, not the builder. CHECKS, does not fix. Invoked as `/verify-code <issue-url>` by the site-orch Verify handler. Repo-local; do NOT load the Edge `/pr-review`.
---

<goal>Verify ONE code task's PR (the GitHub issue passed as `/verify-code <issue-url>`) COLD: confirm it works on the real preview deployment, then review the diff as an adversarial outside reviewer. Binary verdict: any change request (broken preview OR review finding) routes back to Pending; clean routes to Verified. You did NOT write this code. You CHECK, you do NOT fix.</goal>

<rules>
<rule id="site-env">Site values come from the `ORCH_*` env (`$ORCH_REPO`, `$ORCH_BRANCH_PREFIX`, `$ORCH_DIR`). If `$ORCH_REPO` is empty, run `eval "$(bash ~/git/site-orch/env.sh)"` from the repo root first.</rule>
<rule id="hands-off">ONE turn, unattended. Before flagging blocked run `/validate-block <issue-url> "<reason>"` and obey it (true: add the `blocked` label, do NOT change the state, post the blocker, stop).</rule>
<rule id="check-not-fix">You verify and report; you do NOT edit code. File each problem as a change request and route the task to Pending. NEVER route to Running: no handler spawns for Running, so the task strands until the watchdog wrongly flags it blocked.</rule>
<rule id="mobile-meaning">At 390 wide, before any interaction, list what the first screen conveys (names, roles, links, what the centrepiece is). If it conveys less than the desktop first screen, or its meaning depends on hover, that is a change request. A page that only makes sense with a mouse is a mobile defect by definition; passing the overflow check does not clear this rule.</rule>
<rule id="binary-verdict">A finding is either a CHANGE REQUEST (worth a code change before land) or you do not raise it. No nit tier.</rule>
<rule id="self-review-limit">Same-account PR, so GitHub forbids a formal APPROVE/REQUEST_CHANGES (422); submit the review with `event=COMMENT`. Routing is driven by whether you filed change-request threads.</rule>
<rule id="feedback-comments">ANY issue comment not starting with `<!--` is human feedback; it is consumed only when it carries the orch's +1 reaction. An unconsumed one the work did not act on is a change request. When directives conflict, the newest wins.</rule>
<rule id="orch-comment-marker">EVERY issue comment you post MUST start with an HTML marker (`<!-- orch -->` or a specific one); unmarked comments are reserved for the human.</rule>
</rules>

<step id="1" name="Read and resolve the PR">
Parse `<n>`. `pr=$(gh pr list --repo $ORCH_REPO --head ${ORCH_BRANCH_PREFIX}<n> --state open --json number -q '.[0].number')`. If empty: `/validate-block`, then add `blocked`. Read `gh issue view <n> --repo $ORCH_REPO` (the requirement) and `gh pr diff <pr> --repo $ORCH_REPO`. Load the repo CLAUDE.md standards.
</step>

<step id="2" name="Preview-test">
`bash $ORCH_DIR/verify-preview.sh <pr> "<expected-substring>"` (a string that proves the change rendered; includes the mobile capture). A mobile site (`verify.kind` = mobile in orch.config.json) has no preview URL: the same command runs the Android pipeline and prints `FINGERPRINT=`, `APK=`, `MAESTRO=` and a `SCREENSHOT=` per flow under the same `RESULT=` contract. When a `SCREENSHOT_URL=` line accompanies a screenshot, EMBED THAT URL in every issue comment and PR review you post: the repo may be private, and GitHub renders images in PR and issue bodies only from anonymously fetchable URLs (raw.githubusercontent.com links to a private repo show as broken). Committed screenshots under `docs/screenshots/` stay the record for the run report file, which renders them when viewed in the repo. `RESULT=fail` because the CODE is wrong is a change request. A transient deploy hiccup: retry once or twice. Note the `SCREENSHOT=` paths.
</step>

<step id="3" name="Cold review">
Review the diff for correctness and logic, security, the repo's TypeScript standards, its design-system rules, and spec adherence (does it do what issue #<n> asked?). Each finding worth a code change is a CHANGE REQUEST anchored to file:line; do not invent findings.
</step>

<step id="4" name="Post and route (binary)">
- **Any change requests**: post ONE formal review via the reviews API: `gh api -X POST repos/$ORCH_REPO/pulls/<pr>/reviews --input <payload.json>` with `{ "event":"COMMENT", "body":"<!-- review-task --> CHANGES REQUESTED (<k>)", "comments":[{"path":...,"line":...,"side":"RIGHT","body":"<what, why, fix>"}, ...] }` (build the payload with the editor, not a heredoc). Then `bash $ORCH_DIR/board.sh status <n> Pending`.
- **Clean**: write the run report by filling `$ORCH_DIR/templates/run-report.md` into `docs/run-reports/issue-<n>-<slug>.md`, commit the screenshots under `docs/screenshots/`, push, and post the report on the issue (lead with the live preview URL, or with the screenshots for a mobile site). Then `bash $ORCH_DIR/board.sh status <n> Verified`.
Print a one-line summary (issue, PR, verdict, next state), then stop.
</step>

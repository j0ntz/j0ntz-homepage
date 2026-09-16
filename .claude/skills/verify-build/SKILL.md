---
name: verify-build
description: Independently verify ONE Verifying code task. build and run its change on the tenant's real target (a web preview deployment or the Android emulator) through verify-run.sh, then review the diff cold, and route it binary. change requests -> Pending, clean -> Verified. Fresh agent, not the builder. CHECKS, does not fix. Invoked as `/verify-build <issue-url>` by the site-orch Verify handler. Repo-local; do NOT load the Edge `/pr-review`.
---

<goal>Verify ONE code task's PR (the GitHub issue passed as `/verify-build <issue-url>`) COLD: first build and run the change and confirm it works, then review the diff as an adversarial outside reviewer. Binary verdict: any change request (a failed run OR a review finding) routes back to Pending; clean routes to Verified. You did NOT write this code. You CHECK, you do NOT fix.</goal>

<rules>
<rule id="tenant-env">Tenant values come from the `ORCH_*` env (`$ORCH_REPO`, `$ORCH_BRANCH_PREFIX`, `$ORCH_DIR`). If `$ORCH_REPO` is empty, run `eval "$(bash ~/git/site-orch/env.sh)"` from the repo root first.</rule>
<rule id="hands-off">ONE turn, unattended. Before flagging blocked run `/validate-block <issue-url> "<reason>"` and obey it (true: add the `blocked` label, do NOT change the state, post the blocker, stop).</rule>
<rule id="check-not-fix">You verify and report; you do NOT edit code. File each problem as a change request and route the task to Pending. NEVER route to Running: no handler spawns for Running, so the task strands until the watchdog wrongly flags it blocked.</rule>
<rule id="run-before-review">Step 2 (run) always happens before step 3 (review). A diff that reads well but does not run is a change request; a clean run does not excuse a review finding.</rule>
<rule id="binary-verdict">A finding is either a CHANGE REQUEST (worth a code change before land) or you do not raise it. No nit tier.</rule>
<rule id="self-review-limit">Same-account PR, so GitHub forbids a formal APPROVE/REQUEST_CHANGES (422); submit the review with `event=COMMENT`. Routing is driven by whether you filed change-request threads.</rule>
<rule id="feedback-comments">ANY issue comment not starting with `<!--` is human feedback; it is consumed only when it carries the orch's +1 reaction. An unconsumed one the work did not act on is a change request. When directives conflict, the newest wins.</rule>
<rule id="spec-on-disk">The task spec is read from `$ORCH_TASK_DIR` (issue.md, comments.json, pr.diff, review-comments.json; `bash $ORCH_DIR/task-spec.sh fetch <n>` refreshes it) with the Read tool, paged when long. Stdout reads of it are denied by a hook, and `board.sh status` refuses your routing transition until every required file was read in full.</rule>
<rule id="orch-comment-marker">EVERY issue comment you post MUST start with an HTML marker (`<!-- orch -->` or a specific one); unmarked comments are reserved for the human.</rule>
</rules>

<step id="1" name="Read and resolve the PR">
Parse `<n>`. `pr=$(gh pr list --repo $ORCH_REPO --head ${ORCH_BRANCH_PREFIX}<n> --state open --json number -q '.[0].number')`. If empty: `/validate-block`, then add `blocked`. `bash $ORCH_DIR/task-spec.sh fetch <n>`; then Read `$ORCH_TASK_DIR/issue.md`, `comments.json`, `pr.diff` (paged; `pr-files.txt` lists the files) and `review-comments.json` (`spec-on-disk`). Load the repo CLAUDE.md standards. Note `verify.kind` in `orch.config.json`: `mobile` means the android path below, anything else the web path.
</step>

<step id="2" name="Build and run">
`bash $ORCH_DIR/verify-run.sh <pr> "<expected>"`, where `<expected>` is a string that proves the change rendered (page text on web, visible text on android). It prints one `KEY=value` per line.

**The contract both paths share**
- `RESULT=pass|fail` is the verdict of the run. `RESULT=fail` with an `ERROR=` that shows the CODE is wrong (build error, failed flow, missing expected text, broken page) is a change request, quoted in your review. A transient infrastructure hiccup (a deploy still building, the emulator lock held by another run) is not: rerun once or twice.
- `HEAD_SHA=` is the commit that was run; confirm it is the PR head.
- `SCREENSHOT=<path>` lines are the visual evidence; look at every one of them with the Read tool and judge whether it shows the change the issue asked for. A screenshot that shows the wrong thing is a change request even under `RESULT=pass`.
- `SCREENSHOT_URL=<url>`, when it follows a `SCREENSHOT=`, is the public copy of that image. EMBED THAT URL in every issue comment and PR review you post: the repo may be private, and GitHub renders images in PR and issue bodies only from anonymously fetchable URLs (raw.githubusercontent.com links to a private repo show as broken). Committed screenshots under `docs/screenshots/` stay the record for the run report file, which renders them when viewed in the repo.

**Android path** (`verify.kind` = mobile). `verify-run.sh` hands off to `verify-android.sh`: it waits for the PR's GitHub checks (`CI=`; `CI=fail` is a change request), computes the native fingerprint (`FINGERPRINT=`), builds or reuses the dev-client APK for it (`BUILD=native|cached`, `APK=`), installs it on the orch emulator with fresh app data, starts Metro, opens the app, asserts `<expected>` (`EXPECTED=found|missing`), runs every flow under `.maestro/` (`FLOW=<name> pass|fail`, then `MAESTRO=pass|fail`) and captures a `SCREENSHOT=` at launch and per flow. On a failed flow Read its log (the path is on the `FLOW=` line) before writing the change request. A tenant with a release channel also prints `ANDROID_FINGERPRINT=`, `APK_FINGERPRINT=` (the installed APK's) and `NEEDS_APK=yes|no|unknown`: note them for step 4. `NEEDS_APK=yes` is not a change request by itself (a new native dependency is often the point of the task); it is a change request only when the spec did not call for a native change and the diff shows none was intended.

**Web path** (any other kind). `verify-run.sh` resolves the PR's preview deployment (`PREVIEW_URL=`), asserts it answers 200 without an error or login page and contains `<expected>` (`HTTP_STATUS=`), and captures a desktop `SCREENSHOT=` and a 390-wide `SCREENSHOT_MOBILE=`; `MOBILE_OVERFLOW=1` means the page overflows its mobile width (a change request). Mobile meaning: at 390 wide, before any interaction, list what the first screen conveys (names, roles, links, what the centrepiece is). If it conveys less than the desktop first screen, or its meaning depends on hover, that is a change request. A page that only makes sense with a mouse is a mobile defect by definition; passing the overflow check does not clear this rule.
</step>

<step id="3" name="Cold review">
Review the diff for correctness and logic, security, the repo's TypeScript standards, its design-system rules, and spec adherence (does it do what issue #<n> asked?). Each finding worth a code change is a CHANGE REQUEST anchored to file:line; do not invent findings.
</step>

<step id="4" name="Post and route (binary)">
- **Any change requests**: post ONE formal review via the reviews API: `gh api -X POST repos/$ORCH_REPO/pulls/<pr>/reviews --input <payload.json>` with `{ "event":"COMMENT", "body":"<!-- review-task --> CHANGES REQUESTED (<k>)", "comments":[{"path":...,"line":...,"side":"RIGHT","body":"<what, why, fix>"}, ...] }` (build the payload with the editor, not a heredoc). Then `bash $ORCH_DIR/board.sh status <n> Pending`.
- **Clean**: write the run report by filling `$ORCH_DIR/templates/run-report.md` into `docs/run-reports/issue-<n>-<slug>.md`, commit the screenshots under `docs/screenshots/`, push, and post the report on the issue (lead with the live preview URL on the web path, with the screenshots on the android path). When step 2 printed `NEEDS_APK=yes`, both the run report and the issue comment state, verbatim and with the two fingerprints after it: "This PR changes the native fingerprint; a new APK is needed after landing." (the lander builds and posts it). `NEEDS_APK=unknown`: say the fingerprint could not be compared with the installed APK. Then `bash $ORCH_DIR/board.sh status <n> Verified`.
Print a one-line summary (issue, PR, verdict, next state), then stop.
</step>

---
name: work-task
description: Take ONE board task (a GitHub issue) from Pending to its deliverable, hands-off, then route it to Verifying. Branches on flavor (code, doc, ops). On re-entry it ADDRESSES open review threads and unconsumed human comments. Invoked as `/work-task <issue-url>` by the site-orch Pending handler. Repo-local; do NOT load the Edge `/im` or `/pr-address`.
---

<goal>Take ONE task (the GitHub issue passed as `/work-task <issue-url>`) from Pending/Running to its deliverable, fully hands-off, then set it Verifying for the independent check. Two modes: INITIAL work, or ADDRESS (the PR carries unresolved review threads, or the issue carries unconsumed human comments). Never merge; the lander does that.</goal>

<rules>
<rule id="site-env">The site is addressed through the `ORCH_*` env the orch exported into this session: `$ORCH_REPO` (owner/repo), `$ORCH_BRANCH_PREFIX` (task branches are `${ORCH_BRANCH_PREFIX}<n>`), `$ORCH_DIR` (the site-orch install; `$ORCH_DIR/board.sh` is the board tool), `$ORCH_BUILD_CMD`. If `$ORCH_REPO` is empty (interactive use), run `eval "$(bash ~/git/site-orch/env.sh)"` from the repo root first.</rule>
<rule id="hands-off">Run in ONE turn, unattended (no AskUserQuestion). Before flagging blocked you MUST run `/validate-block <issue-url> "<reason>"` and obey it: `legitimate:false` means do its `what_to_try` and continue; only `legitimate:true` means add the `blocked` label (do NOT change the state), post ONE line naming the blocker, stop.</rule>
<rule id="scope">Work ONLY in the current worktree (your cwd). Commit to THIS branch. Never merge, tag, publish, or deploy. An ops task may drive OTHER tasks' board state and branches, but only as the issue directs.</rule>
<rule id="conventions">Follow this repo's CLAUDE.md (its TypeScript standards and design system, repo-local skills, plain `git commit`). Use npm; prefix `sfw` if your shell blocks bare npm/npx.</rule>
<rule id="address-loop-cap">In ADDRESS mode, count prior rounds by issue comments carrying the marker `<!-- address-round -->` that are NEWER than the newest human comment (fresh human feedback resets the cap). If 2 such rounds already happened, do NOT address again: `/validate-block`, then add the `blocked` label.</rule>
<rule id="orch-comment-marker">EVERY issue comment you post MUST start with an HTML marker: `<!-- orch -->` (or a more specific one like `<!-- address-round -->`). Unmarked comments are reserved for the human.</rule>
<rule id="feedback-comments">ANY issue comment whose body does NOT start with `<!--` is human feedback. UNCONSUMED means it has no +1 reaction yet (check the `reactions` field). Treat each unconsumed one as a requirement equal to a review thread; when directives conflict, the NEWEST wins. A comment with no actionable ask: consume it with a +1 and move on. After acting on one: `gh api -X POST repos/$ORCH_REPO/issues/comments/<id>/reactions -f content='+1'` and list it in your round summary.</rule>
</rules>

<step id="1" name="Read the task, pick the mode, detect the sub-issue role">
Parse `<n>`. `gh issue view <n> --repo $ORCH_REPO --json title,body,labels,comments`. The FLAVOR is in the labels: `research` / `design` / `instructions` / `chore` (any present = doc/ops kind; none = code). Resolve any PR: `pr=$(gh pr list --repo $ORCH_REPO --head ${ORCH_BRANCH_PREFIX}<n> --state open --json number -q '.[0].number')`.
- If (`pr` exists AND it has UNRESOLVED review threads (`gh api repos/$ORCH_REPO/pulls/<pr>/comments`)) OR the issue has UNCONSUMED human comments: **ADDRESS** mode.
- Else: **INITIAL** mode (unconsumed human comments pre-PR are part of the spec: consume and react as in ADDRESS).
Sub-issue role: `bash $ORCH_DIR/board.sh gate <n>` prints `none` (normal task) or `ready`/`waiting` (a **PARENT**, step 2-parent). `bash $ORCH_DIR/board.sh parent <n>` printing a number means this is a **CHILD**: work it normally, but read the parent issue first for context.
`bash $ORCH_DIR/board.sh status <n> Running` (idempotent).
</step>

<step id="2-initial" name="INITIAL: do the work by flavor">
- **code** (no flavor): implement to the issue's definition of done following CLAUDE.md; `git commit`; `$ORCH_BUILD_CMD` (sfw if needed) MUST pass, and on a mobile site the local run CLAUDE.md prescribes (`verify-android.sh local`) MUST pass too (its `SCREENSHOT_URL=` lines, when present, are the image URLs to embed in the PR body; raw links into a private repo do not render there); push; open a PR (`gh pr create --repo $ORCH_REPO --base main --head ${ORCH_BRANCH_PREFIX}<n> --title "<concise>" --body-file <file>` whose body starts with `Closes #<n>`).
- **doc** (`research`/`design`/`instructions`): research (web and codebase) and write the deliverable doc(s) under `docs/` per the issue's deliverables; `git commit`; push; open a PR.
- **ops/`chore`** that operates on the board (no artifact of its own): do the operational work directly per the issue. Do NOT open a PR for THIS task. A research-only investigation: post the findings as an issue comment starting with `<!-- orch -->`; no PR.
</step>

<step id="2-parent" name="INITIAL, parent task: fan-in">
Re-check the gate: `bash $ORCH_DIR/board.sh gate <n>`. On `waiting:<k>/<t>` this spawn was premature: `bash $ORCH_DIR/board.sh status <n> Pending`, print one line, stop. On `ready`, do the parent's OWN fan-in deliverable per its issue body: a repo change is treated as the matching flavor in 2-initial; pure coordination is ONE issue comment summarizing each child (`bash $ORCH_DIR/board.sh children <n>`): number, title, outcome, PR or merge link. Then step 3.
</step>

<step id="2-address" name="ADDRESS: resolve the review threads and feedback">
For each unresolved review thread AND each unconsumed human issue comment: make the minimal correct fix following CLAUDE.md, `git commit`. A human directive may be bigger than a review nit; do the work it actually asks. If code changed, `$ORCH_BUILD_CMD` as a sanity gate. `git push`. Reply to AND resolve each thread: `gh api -X POST repos/$ORCH_REPO/pulls/<pr>/comments/<comment_id>/replies -f body='<addressed or declined, why>'`, then `gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -f t=<threadId>` (thread ids from the PR's `reviewThreads`). React +1 to each consumed human comment. Post ONE `<!-- address-round -->` issue comment summarizing the round by link.
</step>

<step id="3" name="Route to Verifying">
`bash $ORCH_DIR/board.sh status <n> Verifying`. Print a one-line summary (issue, mode, flavor, PR if any), then stop.
</step>

---
name: verify-doc
description: Independently verify ONE Verifying doc or ops task (completeness and soundness; no preview) and route it binary. change requests -> Pending; clean with a PR -> Verified; clean with no PR -> Done. Fresh agent, not the author. CHECKS, does not fix. Invoked as `/verify-doc <issue-url>` by the site-orch Verify handler. Repo-local.
---

<goal>Verify ONE doc or ops task (the GitHub issue passed as `/verify-doc <issue-url>`) COLD. For a doc: does it deliver what the issue asked, are claims and links sound, is it internally consistent and standards-clean. For an ops task: was the operational goal actually met. Binary verdict: change requests route to Pending; clean with an open PR routes to Verified; clean with no PR routes to Done. You CHECK, you do NOT fix.</goal>

<rules>
<rule id="site-env">Site values come from the `ORCH_*` env (`$ORCH_REPO`, `$ORCH_BRANCH_PREFIX`, `$ORCH_DIR`, `$ORCH_BUILD_CMD`). If `$ORCH_REPO` is empty, run `eval "$(bash ~/git/site-orch/env.sh)"` from the repo root first.</rule>
<rule id="hands-off">ONE turn, unattended. Before flagging blocked run `/validate-block <issue-url> "<reason>"` and obey it (true: add the `blocked` label, do NOT change the state, post the blocker, stop).</rule>
<rule id="check-not-fix">Verify and report; do NOT edit. File change requests and route to Pending. NEVER route to Running.</rule>
<rule id="binary-verdict">A finding is either a CHANGE REQUEST or you do not raise it.</rule>
<rule id="feedback-comments">ANY issue comment not starting with `<!--` is human feedback; it is consumed only when it carries the orch's +1 reaction. An unconsumed one the work did not act on is a change request. When directives conflict, the newest wins.</rule>
<rule id="no-truncated-reads">The shell tool shows at most ~20 KB of a command's output; anything longer is replaced by a 2 KB preview plus a file path. A spec read from a preview is a truncated spec. Every spec-bearing read (issue body, issue comments, PR diff, review threads) is written to a file under `/tmp/orch-$ORCH_SLUG-<n>/` and read with the Read tool, paged when long; `gh api` list reads take `--paginate`. Never reason from a preview.</rule>
<rule id="orch-comment-marker">EVERY issue comment you post MUST start with an HTML marker; unmarked comments are reserved for the human.</rule>
</rules>

<step id="1" name="Read and classify">
Parse `<n>`. `D=/tmp/orch-$ORCH_SLUG-<n>; mkdir -p $D; gh issue view <n> --repo $ORCH_REPO --json title,labels; gh issue view <n> --repo $ORCH_REPO --json body -q .body > $D/issue.md; gh api repos/$ORCH_REPO/issues/<n>/comments --paginate > $D/comments.json`, then READ both with the Read tool (see `no-truncated-reads`). Resolve any PR: `pr=$(gh pr list --repo $ORCH_REPO --head ${ORCH_BRANCH_PREFIX}<n> --state open --json number -q '.[0].number')`. A PR present means doc/repo-bound; no PR means research-only or board-ops.
</step>

<step id="2" name="Check">
- **Doc task (PR present)**: `gh pr diff <pr> --repo $ORCH_REPO > $D/pr.diff` and READ it with the Read tool, plus the doc(s). Verify EACH deliverable named in the issue is delivered; spot-check that cited facts and links resolve and the design is sound and self-consistent; if code changed, `$ORCH_BUILD_CMD` must pass. Anything missing, wrong, or unsound is a change request (file:line).
- **Ops task (no PR)**: verify the operational goal stated in the issue is met (target tasks reached their states, PRs merged). Not met is a change request.
- **Parent task** (`bash $ORCH_DIR/board.sh gate <n>` prints anything but `none`): also verify every child is complete (`bash $ORCH_DIR/board.sh children <n>`: each row closed or board-Done) and that the fan-in deliverable matches the children's ACTUAL outcomes.
</step>

<step id="3" name="Post and route (binary)">
- **Any change requests**: for a PR, ONE formal review (`gh api -X POST repos/$ORCH_REPO/pulls/<pr>/reviews --input <payload.json>`, `event=COMMENT`, body `<!-- review-task -->`, one inline thread per request); for an ops task with no PR, ONE issue comment listing them with the `<!-- review-task -->` marker. Then `bash $ORCH_DIR/board.sh status <n> Pending`.
- **Clean, open PR**: `bash $ORCH_DIR/board.sh status <n> Verified`.
- **Clean, no PR**: post a one-line `<!-- orch -->` "verified: <what was confirmed>" issue comment, then `bash $ORCH_DIR/board.sh status <n> Done`.
Print a one-line summary, then stop.
</step>

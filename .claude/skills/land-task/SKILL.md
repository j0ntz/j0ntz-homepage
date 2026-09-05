---
name: land-task
description: Land ONE approved PR (a board task in the Landing state) when a clean merge is not possible. rebase onto main resolving conflicts SEMANTICALLY, verify the build, merge, set Done. The sanctioned merge path; only for Landing-state tasks. Invoked as `/land-task <issue-url>` by the site-orch lander on conflict.
---

<goal>Land the PR for the given task: rebase its branch onto latest `origin/main`, semantically resolving any conflicts, verify the build, merge to main, delete the branch, and set the board to Done. Hands-off, one turn.</goal>

<rules>
<rule id="site-env">Site values come from the `ORCH_*` env (`$ORCH_REPO`, `$ORCH_BRANCH_PREFIX`, `$ORCH_DIR`, `$ORCH_BUILD_CMD`). If `$ORCH_REPO` is empty, run `eval "$(bash ~/git/site-orch/env.sh)"` from the repo root first.</rule>
<rule id="this-is-the-merge">Unlike `/work-task`, landing DOES merge; that is the entire job. Squash-merge the approved PR to `main` and delete its branch.</rule>
<rule id="semantic-resolution-no-block">Do NOT block on rebase conflicts; RESOLVE them. For each conflicted file, merge BOTH sides so the PR's intent AND main's newer changes are preserved (`ours`/HEAD = main being rebased onto; `theirs` = the PR's commit). Remove every conflict marker with a correct, working merge. For lockfiles do NOT hand-merge: take one side then regenerate with the package manager. Block ONLY for a genuine NON-conflict wall.</rule>
<rule id="verify-after-resolve">After resolving and rebasing, run `$ORCH_BUILD_CMD` (prefix `sfw` if required). It MUST pass before you merge.</rule>
<rule id="hands-off">One turn, no interactive questions.</rule>
</rules>

<step id="1" name="Locate">Parse the issue number from `/land-task <url>`. `gh pr list --repo $ORCH_REPO --head ${ORCH_BRANCH_PREFIX}<n> --state open --json number`. You are launched in the task's worktree on that branch; confirm with `git branch --show-current`.</step>
<step id="2" name="Rebase onto main, resolving">`git fetch origin`; `git rebase origin/main`. On each conflict: resolve every file in `git diff --name-only --diff-filter=U` per `semantic-resolution-no-block`, `git add` them, then `GIT_EDITOR=true git rebase --continue`. Repeat until the rebase finishes.</step>
<step id="3" name="Verify">`$ORCH_BUILD_CMD` must pass. If your merge broke it, fix and re-run.</step>
<step id="4" name="Push and merge">`git push --force-with-lease`, then `gh pr merge <pr> --repo $ORCH_REPO --squash --delete-branch`.</step>
<step id="5" name="Done">`bash $ORCH_DIR/board.sh status <n> Done`. Comment on the issue (`<!-- orch -->`): what merged and how you resolved each conflict. Print a one-line summary, then stop.</step>

---
name: verify-code
description: Renamed to verify-build. Kept only so a session that was started as `/verify-code <issue-url>` still works; it follows verify-build with the same argument. Removed once the in-flight tasks finish.
---

<goal>This skill was renamed to `verify-build`. Do the verify-build job for the same issue URL.</goal>

<step id="1" name="Follow verify-build">Read `.claude/skills/verify-build/SKILL.md` in this repo and follow it exactly, treating the argument you were given (`/verify-code <issue-url>`) as `/verify-build <issue-url>`. Where it says `verify-run.sh`, that is the script the old skill called `verify-preview.sh`. If `.claude/skills/verify-build/` does not exist in this worktree, read `$ORCH_DIR/skills/verify-build/SKILL.md` instead.</step>

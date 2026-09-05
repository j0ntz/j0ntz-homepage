---
name: draft-task
description: Front door for the site orchestration. turn a task intent (free text or an idea) into a well-structured GitHub issue, classify its flavor, queue it on the site's board as Pending, and apply the right labels so the orch picks it up. Invoked as `/draft-task <intent...>`. Repo-local.
---

<goal>Turn a task intent into a queued orch task: a structured GitHub issue (Goal / Deliverables / Constraints / Acceptance), the right flavor and automation labels, added to the site's project board and set Pending. Present the draft for confirmation before queueing unless told to queue directly.</goal>

<rules>
<rule id="site-env">Site values come from the `ORCH_*` env (`$ORCH_REPO`, `$ORCH_OWNER`, `$ORCH_PROJECT_NUMBER`, `$ORCH_DIR`). If `$ORCH_REPO` is empty (interactive use), run `eval "$(bash ~/git/site-orch/env.sh)"` from the repo root first.</rule>
<rule id="flavor">Classify the work and set the flavor label(s). None = **code** (produces a code PR). `research` / `design` / `instructions` = a **doc** that lands in the repo. `chore` = **ops/maintenance**. Flavors are multi-select and do NOT decide the path; PR-presence does: a doc or chore that commits a file lands (Verified, Landing, Done); research-only findings or board-ops with no PR go straight to Done.</rule>
<rule id="auto-land">Add `auto-land` only for low-risk, trust-to-merge tasks (most docs, most chores) so they skip the human Verified gate. Leave it off for code you want to eyeball before it merges.</rule>
<rule id="model">The task's agents start on the model and effort in its **Agent Model** / **Agent Effort** board single-selects (unset = the site defaults). Set them only when the caller asked or the task obviously warrants it: `bash $ORCH_DIR/board.sh model <n> "<label>"` (labels are the keys of `agent.modelOptions` in orch.config.json; quote them) and `bash $ORCH_DIR/board.sh effort <n> <low|medium|high|xhigh|max>`. When in doubt leave them unset.</rule>
<rule id="structure">The issue body MUST have **Goal**, **Deliverables** (concrete and checkable), **Constraints** (cite `CLAUDE.md` standards), and **Acceptance**. For a doc task, the deliverables name the doc path(s) under `docs/` and what each must contain. Write the body with the editor (a body file), NOT a heredoc.</rule>
<rule id="split">When the intent holds 2+ deliverables that are independently workable and verifiable, each able to ride its own PR, draft a PARENT plus one CHILD task per deliverable, linked as GitHub sub-issues. The parent's body is the umbrella goal, the fan-in deliverable, and whole-task acceptance; each child's body is self-contained. Children take flavors, model/effort, and `auto-land` individually. The parent is usually `chore` unless its fan-in changes the repo. The watch gate holds the parent in Pending until every child is complete; do not encode ordering between children.</rule>
</rules>

<step id="1" name="Scope">Read the intent. If it is underspecified in a way that would change the deliverable, ask 1-3 sharp questions first (only when truly undeterminable; otherwise pick a defensible default). Decide the flavor(s) and whether `auto-land` fits.</step>

<step id="2" name="Draft">Write the issue body (Goal / Deliverables / Constraints / Acceptance) to a file with the editor. Present it for confirmation unless the caller said to queue directly.</step>

<step id="3" name="Queue">On confirmation:
- `url=$(gh issue create --repo $ORCH_REPO --title "<concise>" --body-file <file> [--label <flavor> ...])`.
- `bash $ORCH_DIR/board.sh add "$url"` (adds it to the board and sets Pending; pass `Backlog` as a second argument to park it).
- if warranted: `bash $ORCH_DIR/board.sh add-label <n> auto-land`.
- if a model or effort was chosen: `bash $ORCH_DIR/board.sh model <n> "<label>"`, `bash $ORCH_DIR/board.sh effort <n> <level>`.
For a SPLIT: create every child issue first, then the parent; link each child with `bash $ORCH_DIR/board.sh add-child <parent#> <child#>`; queue ALL of them; `bash $ORCH_DIR/board.sh add-label <parent#> parent` (visibility only).
Print the issue URL(s), the labels applied, and the model/effort if set. The orch's watch handler picks it up on the next tick.</step>

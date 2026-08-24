# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in `uouoyc/showhow`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Build multi-line bodies with a single-quoted PowerShell here-string and pass the variable to `--body`.
- **Read an issue**: `gh issue view <number> --comments`, also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repository from `git remote -v`; `gh` does this automatically inside the clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

When changed to `yes`, PRs use the same labels and states as issues:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>`.
- **List external PRs**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`, retaining only `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE`.
- **Comment, label, or close**: use `gh pr comment`, `gh pr edit`, and `gh pr close`.

GitHub shares one number space across issues and pull requests. Resolve an ambiguous `#42` using `gh pr view 42`, then fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

The map is a single issue whose child issues are implementation tickets.

- **Map**: an issue labelled `wayfinder:map`, containing Notes, Decisions-so-far, and Fog.
- **Child ticket**: a GitHub sub-issue linked to the map. If sub-issues are unavailable, add it to a task list in the map and put `Part of #<map>` in the child.
- **Child labels**: `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- **Blocking**: use GitHub native issue dependencies. If unavailable, add `Blocked by: #<n>` to the child body.
- **Frontier**: the first unassigned open child whose blockers are all closed.
- **Claim**: `gh issue edit <n> --add-assignee @me`.
- **Resolve**: comment with the result, close the child, then add its context pointer to the map's Decisions-so-far.

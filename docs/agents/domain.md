# Domain Docs

How the engineering skills consume this repository's domain documentation.

## Before exploring, read these

- `CONTEXT.md` at the repository root.
- ADRs under `docs/adr/` that affect the area being changed.

If a file or directory does not exist, proceed silently. Domain documentation is created lazily as terminology and architectural decisions are resolved.

## Layout

Showhow is a single-context repository:

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
├── extension/
└── web/
```

## Use the glossary vocabulary

Use terms exactly as defined in `CONTEXT.md` in issue titles, specifications, tests, refactor proposals, and implementation documentation.

Do not substitute synonyms explicitly listed under `_Avoid_`.

If a required domain concept is missing, reconsider whether new terminology is necessary or capture it through the `domain-modeling` skill.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly rather than silently overriding the decision.

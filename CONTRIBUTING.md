# Contributing

## Prerequisites

- Node 20 or later
- pnpm 12 or later

## Setup

```bash
pnpm install
pnpm typecheck
pnpm test
```

`pnpm demo` runs the seeded demo for manual exploration (see [docs/DEMO.md](docs/DEMO.md)).

## Commit messages

Commits follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, and scopes where useful).

We require a Developer Certificate of Origin sign-off on every commit:

```
Signed-off-by: YOUR NAME <you@example.com>
```

Add it with `git commit -s`. The sign-off certifies that you authored or have the right to submit the change under the project's license.

## Pull requests

- `pnpm typecheck` and `pnpm test` pass on the PR branch.
- The charter compliance checklist in the PR template is completed.
- Architectural changes attach or link an ADR under `docs/adr/`.

## Code style

- Strict TypeScript; ESM modules throughout.
- No new runtime dependencies without justification in the pull request.
- New behaviour ships with tests.

## Package boundaries

Never import across `apps/` or `packages/` except through declared workspace dependencies. If a second package needs code owned by another, declare the dependency in `package.json` or move the code to the package that owns it.

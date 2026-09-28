# stateofpixel

Read these before changing code. Link to them instead of copying their content.

- [README.md](README.md): layout
- [CONTRIBUTING.md](CONTRIBUTING.md): development, environment variables, checks, pull requests
- [docs/DESIGN.md](docs/DESIGN.md): design system for `apps/web`
- [apps/web/src/content/docs](apps/web/src/content/docs): user docs, rendered at `/docs`; the source of truth for user-facing behavior
- [packages/cli/README.md](packages/cli/README.md): the npm page, which links to the docs
- [packages/backend/AGENTS.md](packages/backend/AGENTS.md): Convex guidelines, read before touching `convex/`

## Checks

Run what `ci.yml` runs before handing work back:

```sh
pnpm lint
pnpm --filter stateofpixel build
pnpm typecheck
pnpm test
pnpm build
```

Biome formats and lints; `pnpm format` fixes formatting.

## Conventions

- Commit titles are conventional commits, because release-please builds the CLI changelog from them.
- When user-facing behavior changes, update the docs page in `apps/web/src/content/docs` in the same change.
- Limits, check states, CLI flags and shortcuts render in the docs from code (`convex/lib/limits.ts`, `convex/lib/checkStatus.ts`, `packages/cli/src/reference.ts`, `SHORTCUT_GROUPS`). Change the code, not the docs text.

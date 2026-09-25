# stateofpixel

Read these before changing code. Link to them instead of copying their content.

- [README.md](README.md): layout, development, environments, dogfooding, checks, releases
- [docs/PLAN.md](docs/PLAN.md): why we build it, the stack, costs and risks
- [docs/SPEC.md](docs/SPEC.md): source of truth for behavior, tables, API, CLI and limits
- [docs/DESIGN.md](docs/DESIGN.md): design system for `apps/web`
- [docs/ROADMAP.md](docs/ROADMAP.md): progress; check an item off when it is merged to `main`
- [packages/cli/README.md](packages/cli/README.md): user docs for the CLI, published to npm
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
- When behavior changes, update SPEC.md in the same change.

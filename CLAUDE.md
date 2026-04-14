# CLAUDE.md

Development rules for this repository.

## Mandatory Rules

### 1. Workflow Requirements

Before ANY implementation work, complete these steps in order:

1. **Brainstorming** - Use `superpowers:brainstorming` to clarify requirements
2. **Spec** - Write design spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
3. **Plan** - Use `superpowers:writing-plans` to create implementation plan
4. **Execute** - Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`

**NEVER skip steps or start implementation without approved spec and plan.**

### 2. Documentation Sync

After code changes, update documentation synchronously:

- Package README: `packages/<package>/README.md`
- Root README: `README.md`

**Trigger conditions**: Architecture changes, new features/APIs, config format changes, CLI command changes

### 3. Language Policy

All documentation and code comments MUST be in English.

### 4. Package Management

Use `pnpm` exclusively. NEVER use `npm` or `yarn`.

### 5. Code Quality

Use Biome for linting and formatting. Run before commits:

```bash
pnpm run lint        # Check code quality
pnpm run lint:fix    # Auto-fix issues
pnpm run format      # Format code
```

## References

- [Packages Architecture](docs/reference/packages-architecture.md) - Package details and architecture
- [Skills Reference](docs/reference/skills.md) - Installed skills and usage
- Package READMEs: [telegram-acp](packages/telegram-acp/README.md), [telegram-agent](packages/telegram-agent/README.md), [web-app](packages/web-app/README.md)
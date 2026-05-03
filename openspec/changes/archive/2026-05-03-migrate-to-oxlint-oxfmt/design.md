## Context

The project uses Biome.js (v2.4.9) for linting and formatting TypeScript/JavaScript code across 4 packages: telegram-acp, telegram-agent, web-app, and xiaomi-geteway. The current biome.json configuration includes:

- Linter rules: recommended set plus custom rules for unused imports/variables, import types, namespace usage, and explicit any
- Formatter: 2-space indent, 100 char line width, double quotes, semicolons, ES5 trailing commas
- Package-specific overrides for stricter unused variable checking

Oxlint/oxfmt are Rust-based tools from the Oxide project offering significant performance improvements while maintaining ESLint rule compatibility.

## Goals / Non-Goals

**Goals:**

- Replace Biome with oxlint/oxfmt while preserving equivalent linting and formatting behavior
- Maintain backward compatibility with existing code style (indent, quotes, semicolons, etc.)
- Reduce linting/formatting execution time by 50x or more
- Update project documentation to reflect new tooling

**Non-Goals:**

- Changing existing lint rules or formatting style
- Adding new lint rules beyond equivalent Biome rules
- Modifying CI/CD pipeline structure (only tool replacement)

## Decisions

### Decision 1: Use oxlint + oxfmt instead of single biome package

**Rationale:** Oxlint and oxfmt are separate tools (matching ESLint/Prettier architecture), unlike Biome's unified approach. This separation is intentional by Oxide project design.

**Alternatives considered:**

- Continue with Biome: Would not achieve performance goals
- Use ESLint + Prettier: More mature but slower than oxlint/oxfmt

### Decision 2: Configuration file mapping

| Biome              | Oxlint/oxfmt                |
| ------------------ | --------------------------- |
| biome.json         | oxlint.json + .editorconfig |
| linter.rules       | oxlint.json rules           |
| formatter settings | .editorconfig               |

**Rationale:** oxfmt uses editorconfig for formatting settings (standard format), oxlint uses its own JSON config similar to ESLint.

### Decision 3: Rule mapping

| Biome Rule        | Oxlint Equivalent                          |
| ----------------- | ------------------------------------------ |
| noUnusedImports   | no-unused-vars (ESLint)                    |
| noUnusedVariables | no-unused-vars                             |
| useImportType     | @typescript-eslint/consistent-type-imports |
| noNamespace       | no-namespace (ESLint)                      |
| noExplicitAny     | @typescript-eslint/no-explicit-any         |

## Risks / Trade-offs

**Risk: Rule coverage gaps** → Oxlint may not have exact equivalents for all Biome rules. Mitigation: Map to closest ESLint-compatible rules, accept minor behavioral differences.

**Risk: Editor integration** → IDEs may not have oxlint plugins yet. Mitigation: Document manual setup, oxlint has VS Code extension support.

**Risk: Stability** → Oxlint is newer than ESLint/Biome. Mitigation: It's actively maintained, ESLint-compatible rules are stable.

**Trade-off:** Separate config files vs single biome.json → Accept complexity increase for performance benefit.

## Migration Plan

1. Install oxlint and oxfmt packages
2. Create oxlint.json with equivalent lint rules
3. Create .editorconfig with formatting settings
4. Update package.json scripts
5. Remove biome.json and @biomejs/biome dependency
6. Update CLAUDE.md documentation
7. Run lint/format on all packages to verify compatibility

**Rollback:** Keep biome.json backup, revert package.json changes if issues arise.

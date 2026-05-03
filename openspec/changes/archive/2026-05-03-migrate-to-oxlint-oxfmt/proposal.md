## Why

The project currently uses Biome.js for linting and formatting. Oxlint and oxfmt (from the Oxide project) are next-generation tools written in Rust that offer 50-100x performance improvement over Biome. Migrating will significantly reduce linting/formatting time in both local development and CI/CD pipelines, improving developer experience and reducing build times.

## What Changes

- Replace `@biomejs/biome` with `oxlint` and `oxfmt` packages
- Migrate `biome.json` configuration to `oxlint.json` and `.editorconfig` (oxfmt uses editorconfig)
- Update npm scripts in `package.json`:
  - `lint` → use `oxlint`
  - `lint:fix` → use `oxlint --fix`
  - `format` → use `oxfmt`
- Update CLAUDE.md documentation to reflect new tooling
- Remove Biome dependency and configuration files

**BREAKING**: Configuration format changes from `biome.json` to `oxlint.json` + `.editorconfig`

## Capabilities

### New Capabilities

- `linting`: Linting configuration using oxlint with ESLint-compatible rules
- `formatting`: Code formatting configuration using oxfmt with editorconfig

### Modified Capabilities

None - this is a tooling migration, not a requirements change.

## Impact

- **Affected Code**: All TypeScript/JavaScript files in `packages/` directory
- **Dependencies**: Replace `@biomejs/biome` with `oxlint` and `oxfmt`
- **CI/CD**: Linting and formatting steps will execute significantly faster
- **Developer Workflow**: Same commands (`pnpm run lint`, `pnpm run format`), different underlying tools
- **Configuration Files**:
  - Remove: `biome.json`
  - Add: `oxlint.json`, `.editorconfig`
- **IDE Integration**: Users may need to update editor settings for oxlint/oxfmt

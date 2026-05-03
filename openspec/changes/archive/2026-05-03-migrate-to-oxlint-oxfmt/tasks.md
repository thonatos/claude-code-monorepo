## 1. Setup and Installation

- [x] 1.1 Install oxlint package via pnpm
- [x] 1.2 Install oxfmt package via pnpm
- [x] 1.3 Remove @biomejs/biome dependency

## 2. Configuration Migration

- [x] 2.1 Create oxlint.json with linting rules
- [x] 2.2 Create .editorconfig with formatting settings
- [x] 2.3 Remove biome.json configuration file

## 3. Script Updates

- [x] 3.1 Update `lint` script in package.json to use oxlint
- [x] 3.2 Update `lint:fix` script in package.json to use oxlint --fix
- [x] 3.3 Update `format` script in package.json to use oxfmt

## 4. Documentation Updates

- [x] 4.1 Update CLAUDE.md Code Quality section
- [x] 4.2 Update root README.md if it references biome

## 5. Verification

- [x] 5.1 Run oxlint on all packages to verify rule compatibility
- [x] 5.2 Run oxfmt on all packages to verify formatting output
- [x] 5.3 Verify no breaking changes in lint/format behavior

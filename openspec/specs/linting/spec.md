# linting Specification

## Purpose
TBD - created by archiving change migrate-to-oxlint-oxfmt. Update Purpose after archive.
## Requirements
### Requirement: Linting tool configuration

The system SHALL use oxlint as the primary linting tool for TypeScript and JavaScript files.

#### Scenario: Linting command executes successfully

- **WHEN** developer runs `pnpm run lint`
- **THEN** oxlint checks all TypeScript/JavaScript files in the project

#### Scenario: Linting errors are reported clearly

- **WHEN** oxlint detects code quality issues
- **THEN** errors are displayed with file path, line number, and rule name

### Requirement: Unused imports detection

The system SHALL detect and report unused imports as errors.

#### Scenario: Unused import is flagged

- **WHEN** a file contains an import statement that is not used
- **THEN** oxlint reports an error for the unused import

### Requirement: Unused variables detection

The system SHALL detect and report unused variables.

#### Scenario: Unused variable in telegram-acp package

- **WHEN** a TypeScript file in `packages/telegram-acp/src/**/*.ts` contains an unused variable
- **THEN** oxlint reports an error

#### Scenario: Unused variable in telegram-agent package

- **WHEN** a TypeScript file in `packages/telegram-agent/src/**/*.ts` contains an unused variable
- **THEN** oxlint reports an error

### Requirement: Type-only imports enforcement

The system SHALL enforce use of type-only imports for type definitions.

#### Scenario: Type import is required for types

- **WHEN** a file imports a type definition without using `import type`
- **THEN** oxlint reports an error suggesting type-only import

### Requirement: Explicit any restriction

The system SHALL warn on use of explicit `any` type.

#### Scenario: Explicit any triggers warning

- **WHEN** TypeScript code uses `any` type explicitly
- **THEN** oxlint reports a warning

### Requirement: Auto-fix capability

The system SHALL support automatic fixing of linting issues.

#### Scenario: Auto-fix command resolves issues

- **WHEN** developer runs `pnpm run lint:fix`
- **THEN** oxlint automatically fixes fixable issues in all files


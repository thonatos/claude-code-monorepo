# formatting Specification

## Purpose
TBD - created by archiving change migrate-to-oxlint-oxfmt. Update Purpose after archive.
## Requirements
### Requirement: Formatting tool configuration

The system SHALL use oxfmt as the primary formatting tool for TypeScript and JavaScript files.

#### Scenario: Formatting command executes successfully

- **WHEN** developer runs `pnpm run format`
- **THEN** oxfmt formats all TypeScript/JavaScript files in the project

### Requirement: Indentation style

The system SHALL enforce 2-space indentation.

#### Scenario: Files use 2-space indentation

- **WHEN** oxfmt formats a file
- **THEN** all indentation uses 2 spaces (not tabs)

### Requirement: Line width limit

The system SHALL enforce a maximum line width of 100 characters.

#### Scenario: Lines are wrapped at 100 characters

- **WHEN** a code line exceeds 100 characters
- **THEN** oxfmt wraps the line appropriately

### Requirement: Quote style

The system SHALL enforce double quotes for JavaScript/TypeScript strings.

#### Scenario: Double quotes are used

- **WHEN** oxfmt formats JavaScript/TypeScript code
- **THEN** all string literals use double quotes

### Requirement: Semicolon usage

The system SHALL enforce semicolons at statement endings.

#### Scenario: Semicolons are present

- **WHEN** oxfmt formats JavaScript/TypeScript code
- **THEN** all statements end with semicolons

### Requirement: Trailing commas

The system SHALL use ES5-compatible trailing commas.

#### Scenario: Trailing commas in multiline structures

- **WHEN** oxfmt formats arrays, objects, or function parameters spanning multiple lines
- **THEN** trailing commas are added only where ES5-compatible (not in function parameters)

### Requirement: Editorconfig configuration

The system SHALL use `.editorconfig` file for formatting settings.

#### Scenario: Editorconfig is present

- **WHEN** project is set up
- **THEN** `.editorconfig` file exists with formatting rules

#### Scenario: Editorconfig settings are applied

- **WHEN** oxfmt runs
- **THEN** formatting follows settings defined in `.editorconfig`


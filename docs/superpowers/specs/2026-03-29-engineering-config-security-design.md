# Engineering Configuration & Security Setup Design

**Date:** 2026-03-29
**Author:** Claude
**Status:** Draft → Pending User Review

---

## Overview

Add missing engineering configurations and security checks to the claude-code-monorepo project:

1. Root README.md (standard documentation)
2. Comprehensive .gitignore
3. Biome formatter/linter (root configuration)
4. Commitlint + Husky for git commit message validation
5. Gitleaks for secret/credential detection

---

## 1. Root README.md

### Structure

```markdown
# claude-code-monorepo

Brief description: A pnpm monorepo containing telegram-acp - a bridge connecting Telegram DMs to ACP-compatible AI agents.

## Architecture
- Monorepo structure diagram
- Brief explanation of packages/telegram-acp

## Quick Start
- pnpm install
- Basic setup commands

## CLI Commands
- All telegram-acp CLI commands with examples

## Configuration
- Full YAML config example with field descriptions

## Development
- Build, dev, test commands

## License
- MIT
```

### Content Details

- **Architecture**: Show tree structure of packages, explain telegram-acp role
- **Quick Start**: Include bot token setup via @BotFather
- **CLI Commands**: Document `--preset`, `--config`, `agents` subcommand
- **Configuration**: Full YAML example from CLAUDE.md (proxy, allowedUsers, reaction, session options)

---

## 2. Comprehensive .gitignore

### Categories

| Category | Patterns |
|----------|----------|
| Node.js | `node_modules/`, `dist/`, `build/`, `.npm/`, `.pnpm-store/`, `.pnpm-debug.log*` |
| Environment | `.env`, `.env.*`, `*.local`, `.telegram-acp/` (user runtime config directory) |
| Editor | `.vscode/`, `.idea/`, `*.swp`, `*.swo` |
| OS | `.DS_Store`, `Thumbs.db`, `*.bak` |
| Logs | `*.log`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*` |
| Secrets | `credentials.json`, `secrets.yaml`, `secrets.json`, `*.pem`, `*.key` |
| Test | `coverage/`, `.nyc_output/` |
| Misc | `*.tgz`, `.cache/` |

### Key Addition

Exclude `.telegram-acp/` directory - this is where users store their runtime `config.yaml` with bot tokens. Prevents accidental upload of real credentials.

---

## 3. Biome Formatter/Linter

### Configuration: biome.json (Root)

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "warn"
      },
      "style": {
        "useImportType": "error",
        "noNamespaceImport": "warn"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "es5"
    }
  },
  "overrides": [
    {
      "include": ["packages/telegram-acp/src/**/*.ts"],
      "linter": {
        "rules": {
          "correctness": {
            "noUnusedVariables": "error"
          }
        }
      }
    }
  ]
}
```

### Scripts Added to Root package.json

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check . --write",
    "format": "biome format . --write"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4"
  }
}
```

### Behavior

- Single configuration at root governs entire monorepo
- `pnpm lint` checks all files
- `pnpm lint:fix` auto-fixes safe issues
- `pnpm format` formats all files
- Override for `packages/telegram-acp/src/**/*.ts` enforces stricter variable rules

---

## 4. Commitlint + Husky

### Configuration Files

**commitlint.config.js (Root):**
```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'build', 'ci', 'chore', 'revert'
    ]]
  }
};
```

**package.json additions:**
```json
{
  "devDependencies": {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "husky": "^9.0.0"
  }
}
```

### Husky Setup

1. Run `pnpm dlx husky init` to create `.husky/` directory
2. Create `.husky/commit-msg` hook:
   ```bash
   pnpm commitlint --edit $1
   ```

### Commit Message Format

Valid format: `<type>: <description>`

Examples:
- `feat: add proxy support`
- `fix: session timeout calculation`
- `docs: update README configuration section`
- `chore: add biome formatter`

Invalid examples (rejected):
- `Add proxy support` (missing type)
- `feat add proxy support` (missing colon separator)

---

## 5. Gitleaks (Secret Detection)

### Configuration: .gitleaks.toml (Root)

```toml
title = "Gitleaks configuration"

[extend]
useDefault = true

[allowlist]
description = "Allowlist for known safe patterns in this project"
paths = [
  '''docs/superpowers/.*''',      # Spec/plan docs contain example configs
  '''README\.md''',               # README has example tokens
  '''CLAUDE\.md''',               # CLAUDE.md has example configs
  '''packages/telegram-acp/README\.md'''  # Package README has examples
]
```

### Husky Integration

Create `.husky/pre-commit` hook (append to existing if present):
```bash
gitleaks protect --staged
```

### Prerequisite

Users must install gitleaks binary:
- macOS: `brew install gitleaks`
- Linux: `apt install gitleaks` or download from releases
- Windows: `scoop install gitleaks`

If gitleaks not installed, hook will fail with error message (acceptable - enforces tooling requirement).

---

## 6. Security Verification

### Already Safe

- **Source code**: No hardcoded secrets - `botToken` always loaded from external config file
- **Config loading**: `config.yaml` loaded from `~/.telegram-acp/`, outside repo
- **Existing .gitignore**: Already excludes `.env`

### Additional Protection

| Layer | Mechanism |
|-------|-----------|
| File exclusion | `.gitignore` excludes `.telegram-acp/` directory |
| Pattern detection | Gitleaks pre-commit hook scans staged files |
| Hook enforcement | Husky ensures hooks run before commits accepted |

### Potential Secrets Patterns Detected

Gitleaks default rules detect:
- AWS keys, GitHub tokens, Slack tokens
- Private keys (RSA, PGP)
- Generic high-entropy strings
- Telegram bot tokens (pattern: `[0-9]{8,10}:[a-zA-Z0-9_-]{35}`)

---

## 7. Implementation Order

1. `.gitignore` - foundation for all other changes
2. `biome.json` + package.json scripts - formatter/linter
3. `commitlint.config.js` + husky setup - commit validation
4. `.gitleaks.toml` + pre-commit hook - secret detection
5. `README.md` - documentation (runs lint/format after creation)

---

## 8. Files Changed Summary

| File | Action |
|------|--------|
| `.gitignore` | Replace (expand from 4 lines to ~30 lines) |
| `biome.json` | Create new |
| `commitlint.config.js` | Create new |
| `.gitleaks.toml` | Create new |
| `.husky/commit-msg` | Create new (via husky init) |
| `.husky/pre-commit` | Create/append (gitleaks hook) |
| `package.json` | Edit (add scripts, devDependencies) |
| `README.md` | Create new |

---

## 9. Success Criteria

- [ ] `pnpm lint` runs without errors on existing code
- [ ] `pnpm format` formats all TypeScript files consistently
- [ ] Invalid commit message (e.g., "Add stuff") rejected by hook
- [ ] Valid commit message (e.g., "chore: add linting") accepted
- [ ] Gitleaks detects fake token if added to test file
- [ ] README.md documents all CLI commands and config options
- [ ] `.gitignore` excludes user config directory `.telegram-acp/`
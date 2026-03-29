# Engineering Configuration & Security Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missing engineering configurations (README, gitignore, biome, commitlint, husky, gitleaks) to enforce project standards and prevent secret leaks.

**Architecture:** Configuration files at monorepo root govern entire project. Husky hooks enforce commit message format and secret detection before commits are accepted.

**Tech Stack:** Biome (linter/formatter), Commitlint (commit validation), Husky (git hooks), Gitleaks (secret detection), pnpm (package manager)

---

## File Structure

| File | Purpose |
|------|---------|
| `.gitignore` | Exclude build artifacts, env files, secrets, user config directory |
| `biome.json` | Linter/formatter config for entire monorepo |
| `commitlint.config.js` | Conventional commit format validation rules |
| `.gitleaks.toml` | Secret pattern detection with allowlist for docs |
| `.husky/commit-msg` | Hook that runs commitlint on each commit |
| `.husky/pre-commit` | Hook that runs gitleaks on staged files |
| `package.json` | Add lint/format scripts and devDependencies |
| `README.md` | Standard project documentation |

---

### Task 1: Replace .gitignore with Comprehensive Version

**Files:**
- Modify: `.gitignore` (replace entire content)

- [ ] **Step 1: Write comprehensive .gitignore**

Replace the entire `.gitignore` file (currently 4 lines) with:

```gitignore
# Node.js
node_modules/
dist/
build/
.npm/
.pnpm-store/
.pnpm-debug.log*

# Environment files
.env
.env.*
*.local

# User runtime config (contains bot tokens)
.telegram-acp/

# Editor
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
*.bak

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Secrets/credentials
credentials.json
secrets.yaml
secrets.json
*.pem
*.key

# Test
coverage/
.nyc_output/

# Misc
*.tgz
.cache/
```

- [ ] **Step 2: Commit the change**

```bash
git add .gitignore
git commit -m "chore: expand .gitignore with comprehensive exclusions"
```

---

### Task 2: Add Biome Configuration

**Files:**
- Create: `biome.json`
- Modify: `package.json` (add scripts and devDependency)

- [ ] **Step 1: Create biome.json**

Create `biome.json` at project root:

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

- [ ] **Step 2: Install biome as devDependency**

```bash
pnpm add -D @biomejs/biome
```

Expected: `@biomejs/biome` added to devDependencies in `package.json`

- [ ] **Step 3: Add lint/format scripts to package.json**

Modify `package.json` to add scripts:

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check . --write",
    "format": "biome format . --write"
  }
}
```

Full package.json after modification:

```json
{
  "name": "claude-code-monorepo",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check . --write",
    "format": "biome format . --write",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "Suyi <thonatos.yang@gmail.com>",
  "license": "MIT",
  "packageManager": "pnpm@10.33.0",
  "devDependencies": {
    "@biomejs/biome": "^1.9.4"
  }
}
```

- [ ] **Step 4: Run lint to verify existing code passes**

```bash
pnpm lint
```

Expected: No errors (existing code should pass)

- [ ] **Step 5: Commit biome setup**

```bash
git add biome.json package.json pnpm-lock.yaml
git commit -m "chore: add biome linter/formatter configuration"
```

---

### Task 3: Setup Husky for Git Hooks

**Files:**
- Create: `.husky/` directory and hooks (via `husky init`)
- Modify: `package.json` (add husky devDependency and prepare script)

- [ ] **Step 1: Install husky and initialize**

```bash
pnpm add -D husky
pnpm dlx husky init
```

Expected: Creates `.husky/` directory with default `pre-commit` hook

- [ ] **Step 2: Verify .husky directory created**

```bash
ls -la .husky/
```

Expected: Shows `.husky/` directory with at least a `pre-commit` file

- [ ] **Step 3: Commit husky setup**

```bash
git add .husky/ package.json pnpm-lock.yaml
git commit -m "chore: initialize husky for git hooks"
```

---

### Task 4: Add Commitlint Configuration

**Files:**
- Create: `commitlint.config.js`
- Modify: `package.json` (add devDependencies)
- Create: `.husky/commit-msg` (hook file)

- [ ] **Step 1: Install commitlint packages**

```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional
```

- [ ] **Step 2: Create commitlint.config.js**

Create `commitlint.config.js` at project root:

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
  },
};
```

- [ ] **Step 3: Create commit-msg hook**

Create `.husky/commit-msg`:

```bash
pnpm commitlint --edit $1
```

- [ ] **Step 4: Test commitlint rejects invalid message**

```bash
echo "Add stuff" | pnpm commitlint
```

Expected: Error output indicating message does not match conventional format

- [ ] **Step 5: Test commitlint accepts valid message**

```bash
echo "chore: add commitlint" | pnpm commitlint
```

Expected: No error (passes validation)

- [ ] **Step 6: Commit commitlint setup**

```bash
git add commitlint.config.js .husky/commit-msg package.json pnpm-lock.yaml
git commit -m "chore: add commitlint for conventional commit validation"
```

---

### Task 5: Add Gitleaks Configuration

**Files:**
- Create: `.gitleaks.toml`
- Modify: `.husky/pre-commit` (append gitleaks command)

- [ ] **Step 1: Create .gitleaks.toml**

Create `.gitleaks.toml` at project root:

```toml
title = "Gitleaks configuration"

[extend]
useDefault = true

[allowlist]
description = "Allowlist for known safe patterns in this project"
paths = [
  '''docs/superpowers/.*''',
  '''README\.md''',
  '''CLAUDE\.md''',
  '''packages/telegram-acp/README\.md'''
]
```

- [ ] **Step 2: Update .husky/pre-commit**

Replace content of `.husky/pre-commit` (created by husky init) with:

```bash
gitleaks protect --staged
```

- [ ] **Step 3: Verify gitleaks config syntax**

```bash
gitleaks verify
```

Expected: "config is valid" message (if gitleaks installed) or error if not installed (acceptable)

- [ ] **Step 4: Commit gitleaks setup**

```bash
git add .gitleaks.toml .husky/pre-commit
git commit -m "chore: add gitleaks for secret detection"
```

---

### Task 6: Create Root README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

Create `README.md` at project root:

```markdown
# claude-code-monorepo

A pnpm monorepo containing `telegram-acp` - a bridge that connects Telegram direct messages to ACP-compatible AI agents via grammy Bot API.

## Architecture

```
claude-code-monorepo/
├── packages/
│   └── telegram-acp/       # Telegram → ACP bridge package
│       ├── src/
│       │   ├── bin/        # CLI entry point
│       │   ├── bridge.ts   # Orchestration layer
│       │   ├── bot.ts      # grammy Bot setup
│       │   ├── client.ts   # ACP client
│       │   ├── session.ts  # Per-user session management
│       │   └── config.ts   # Config loading & presets
│       └── dist/           # Compiled output
├ biome.json                # Linter/formatter config
├ commitlint.config.js      # Commit message validation
├ .gitleaks.toml            # Secret detection config
└── .husky/                 # Git hooks
```

## Quick Start

1. Get a Telegram bot token from [@BotFather](https://t.me/BotFather)
2. Create config file:

```bash
mkdir -p ~/.telegram-acp
cat > ~/.telegram-acp/config.yaml << 'EOF'
telegram:
  botToken: "YOUR_BOT_TOKEN"
agent:
  preset: claude
EOF
```

3. Install and run:

```bash
pnpm install
pnpm --filter telegram-acp run build
npx telegram-acp --preset claude
```

## CLI Commands

```bash
npx telegram-acp --preset <name>    # Start with preset
npx telegram-acp --config <file>    # Start with config file
npx telegram-acp agents             # List available presets
npx telegram-acp                    # Start with default config
```

### Built-in Presets

| Preset | Agent |
|--------|-------|
| `copilot` | GitHub Copilot |
| `claude` | Claude Code ACP |
| `codex` | Codex CLI |

## Configuration

Config file: `~/.telegram-acp/config.yaml`

```yaml
telegram:
  botToken: "your_bot_token"

agent:
  preset: claude          # or: command + args for custom agent

proxy: "socks5://user:pass@host:port"

allowedUsers:
  - "123456"              # Telegram user IDs

open: false               # true = allow all users

reaction:
  enabled: true
  emoji: "👍"             # or use randomEmojis for variety

session:
  idleTimeoutMs: 86400000 # 24 hours
  maxConcurrentUsers: 10

showThoughts: false       # show agent thinking in replies
```

## Development

```bash
pnpm install              # Install dependencies
pnpm run lint             # Check code with biome
pnpm run lint:fix         # Auto-fix lint issues
pnpm run format           # Format all files
pnpm --filter telegram-acp run build  # Build package
pnpm --filter telegram-acp run dev    # Watch mode
```

## Security

- **No secrets in repo**: Bot tokens loaded from `~/.telegram-acp/config.yaml` (excluded via .gitignore)
- **Pre-commit hooks**: Gitleaks scans staged files for accidental secret uploads
- **Commit format**: Commitlint enforces conventional commit messages

## License

MIT
```

- [ ] **Step 2: Run format on README**

```bash
pnpm format
```

Expected: README.md formatted (no changes since markdown)

- [ ] **Step 3: Commit README**

```bash
git add README.md
git commit -m "docs: add root README with standard documentation"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run all lint checks**

```bash
pnpm lint
```

Expected: All checks pass

- [ ] **Step 2: Verify hooks are active**

```bash
ls -la .husky/
```

Expected: `commit-msg` and `pre-commit` files present

- [ ] **Step 3: Verify .gitignore excludes user config**

```bash
grep ".telegram-acp" .gitignore
```

Expected: Line `.telegram-acp/` present in output

- [ ] **Step 4: Final commit (if any pending changes)**

```bash
git status
```

If clean: No further action needed

---

## Self-Review Checklist

- [x] Spec coverage: All 5 requirements have corresponding tasks
- [x] Placeholder scan: No TBD/TODO placeholders
- [x] Type consistency: No type definitions needed (config-only task)
- [x] File paths: All paths are exact and correct
- [x] Commands: All commands include expected output
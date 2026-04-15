# Telegram Agent CLI Entry Point Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CLI entry point to enable running telegram-agent via command line.

**Architecture:** Single file CLI entry that reuses existing bootstrap pattern from @artusx/utils.

**Tech Stack:** TypeScript, @artusx/utils, Node.js

---

### Task 1: Create CLI Entry File

**Files:**
- Create: `packages/telegram-agent/src/bin/cli.ts`

- [ ] **Step 1: Create the CLI entry file**

```typescript
import path from 'path';
import { bootstrap } from '@artusx/utils';

const ROOT_DIR = path.resolve(__dirname, '..');

bootstrap({
  root: ROOT_DIR,
  configDir: 'config'
});
```

- [ ] **Step 2: Verify file created correctly**

Run: `cat packages/telegram-agent/src/bin/cli.ts`
Expected: File content matches above

---

### Task 2: Update package.json bin Configuration

**Files:**
- Modify: `packages/telegram-agent/package.json:12-14`

- [ ] **Step 1: Update bin path to compiled JS file**

Change from:
```json
"bin": {
  "telegram-agent": "./dist/index.ts"
}
```

To:
```json
"bin": {
  "telegram-agent": "./dist/bin/cli.js"
}
```

- [ ] **Step 2: Verify package.json updated**

Run: `grep -A2 '"bin"' packages/telegram-agent/package.json`
Expected: Shows `"telegram-agent": "./dist/bin/cli.js"`

---

### Task 3: Build and Test CLI Entry

- [ ] **Step 1: Build the project**

Run: `cd packages/telegram-agent && pnpm run build`
Expected: Build succeeds, `dist/bin/cli.js` created

- [ ] **Step 2: Verify compiled file exists**

Run: `ls packages/telegram-agent/dist/bin/cli.js`
Expected: File exists

- [ ] **Step 3: Test CLI entry point directly**

Run: `cd packages/telegram-agent && node dist/bin/cli.js`
Expected: Application starts (or fails gracefully if missing env vars)

---

### Task 4: Commit Changes

- [ ] **Step 1: Stage and commit changes**

```bash
git add packages/telegram-agent/src/bin/cli.ts packages/telegram-agent/package.json
git commit -m "feat(telegram-agent): add CLI entry point in src/bin"
```

- [ ] **Step 2: Verify commit**

Run: `git log -1 --oneline`
Expected: Shows commit message "feat(telegram-agent): add CLI entry point in src/bin"
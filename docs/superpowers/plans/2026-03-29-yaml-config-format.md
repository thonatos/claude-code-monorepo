# YAML Config Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch telegram-acp config file format from JSON to YAML.

**Architecture:** Add `yaml` dependency, update `loadConfig()` to parse YAML, change default config path from `config.json` to `config.yaml`.

**Tech Stack:** TypeScript, yaml package, pnpm

---

## File Structure

| File | Change |
|------|--------|
| `packages/telegram-acp/package.json` | Add `yaml` dependency |
| `packages/telegram-acp/src/config.ts` | Update loadConfig() to parse YAML |
| `packages/telegram-acp/src/bin/telegram-acp.ts` | Update CLI help text |

---

### Task 1: Add yaml dependency

**Files:**
- Modify: `packages/telegram-acp/package.json`

- [ ] **Step 1: Install yaml package**

```bash
cd packages/telegram-acp && pnpm add yaml
```

- [ ] **Step 2: Commit dependency change**

```bash
git add packages/telegram-acp/package.json pnpm-lock.yaml
git commit -m "chore: add yaml dependency for config parsing"
```

---

### Task 2: Update config.ts to parse YAML

**Files:**
- Modify: `packages/telegram-acp/src/config.ts`

- [ ] **Step 1: Add yaml import and update loadConfig()**

Change the import section to add yaml:

```typescript
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { parse as parseYaml } from "yaml";
```

Update the `loadConfig()` function to use YAML:

```typescript
export function loadConfig(configPath?: string, presetArg?: string): TelegramAcpConfig {
  const config = defaultConfig();

  // Determine config file path
  const filePath = configPath ?? path.join(defaultStorageDir(), "config.yaml");

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8");
    const fileConfig = parseYaml(content) as Partial<TelegramAcpConfig>;

    // Merge nested objects
    if (fileConfig.telegram) config.telegram = fileConfig.telegram;
    if (fileConfig.agent) {
      config.agent.preset = fileConfig.agent.preset ?? config.agent.preset;
      config.agent.command = fileConfig.agent.command ?? config.agent.command;
      config.agent.args = fileConfig.agent.args ?? config.agent.args;
      config.agent.cwd = fileConfig.agent.cwd ?? config.agent.cwd;
      config.agent.env = fileConfig.agent.env ?? config.agent.env;
      config.agent.showThoughts = fileConfig.agent.showThoughts ?? config.agent.showThoughts;
    }
    if (fileConfig.session) {
      config.session.idleTimeoutMs = fileConfig.session.idleTimeoutMs ?? config.session.idleTimeoutMs;
      config.session.maxConcurrentUsers = fileConfig.session.maxConcurrentUsers ?? config.session.maxConcurrentUsers;
    }
    if (fileConfig.reaction) config.reaction = fileConfig.reaction;

    // Top-level fields
    if (fileConfig.proxy) config.proxy = fileConfig.proxy;
    if (fileConfig.allowedUsers) config.allowedUsers = fileConfig.allowedUsers;
    if (fileConfig.open) config.open = fileConfig.open;
  }

  // Resolve preset (CLI arg takes precedence)
  const presetName = presetArg ?? config.agent.preset;
  if (presetName) {
    const resolved = resolvePreset(presetName);
    if (resolved) {
      config.agent.preset = resolved.id;
      config.agent.command = resolved.preset.command;
      config.agent.args = resolved.preset.args;
      if (resolved.preset.env) {
        config.agent.env = { ...config.agent.env, ...resolved.preset.env };
      }
    } else {
      // Not a preset name, parse as raw command
      const parsed = parseAgentCommand(presetName);
      config.agent.command = parsed.command;
      config.agent.args = parsed.args;
    }
  }

  return config;
}
```

- [ ] **Step 2: Commit config.ts change**

```bash
git add packages/telegram-acp/src/config.ts
git commit -m "feat: switch config format from JSON to YAML"
```

---

### Task 3: Update CLI help text

**Files:**
- Modify: `packages/telegram-acp/src/bin/telegram-acp.ts`

- [ ] **Step 1: Update usage text to reference config.yaml**

In the `usage()` function, change the config file example from JSON to YAML:

```typescript
function usage(): void {
  const presets = listPresets()
    .map(({ id }) => id)
    .join(", ");

  console.log(`
telegram-acp — Bridge Telegram to ACP-compatible AI agents

Usage:
  telegram-acp --preset <name>    Start with preset (config from ~/.telegram-acp/config.yaml)
  telegram-acp --config <file>    Start with config file
  telegram-acp agents             List available presets
  telegram-acp                    Start with default config

Presets: ${presets}

Config file format (~/.telegram-acp/config.yaml):
  telegram:
    botToken: "..."
  agent:
    preset: claude
  proxy: "socks5://..."
  allowedUsers:
    - "12345"
  open: false
  reaction:
    enabled: true
`);
`);
}
```

- [ ] **Step 2: Commit CLI update**

```bash
git add packages/telegram-acp/src/bin/telegram-acp.ts
git commit -m "docs: update CLI help to show YAML config format"
```

---

### Task 4: Update README documentation

**Files:**
- Modify: `packages/telegram-acp/README.md`

- [ ] **Step 1: Update README config examples to YAML format**

Update any config file examples in README.md to use YAML format instead of JSON.

- [ ] **Step 2: Commit README update**

```bash
git add packages/telegram-acp/README.md
git commit -m "docs: update README to show YAML config format"
```

---

### Task 5: Build and verify

- [ ] **Step 1: Build the package**

```bash
cd packages/telegram-acp && pnpm run build
```

Expected: TypeScript compiles without errors.

- [ ] **Step 2: Test CLI help**

```bash
node packages/telegram-acp/dist/bin/telegram-acp.js --help
```

Expected: Shows usage with YAML config format example.

- [ ] **Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "chore: verify build passes"
```

---

## Success Criteria

- [ ] `pnpm run build` passes
- [ ] CLI help shows YAML config format
- [ ] README shows YAML config format
- [ ] Config file path defaults to `~/.telegram-acp/config.yaml`
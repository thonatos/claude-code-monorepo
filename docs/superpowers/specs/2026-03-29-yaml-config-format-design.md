# YAML Config Format Spec

## Overview

Switch telegram-acp config file format from JSON to YAML for better readability and comment support.

## Changes

### Files Modified

| File | Change |
|------|--------|
| `packages/telegram-acp/src/config.ts` | Update `loadConfig()` to parse YAML |
| `packages/telegram-acp/package.json` | Add `yaml` dependency |

### Config File

**Default path:** `~/.telegram-acp/config.yaml` (changed from `config.json`)

**Format:**
```yaml
telegram:
  botToken: "your-token"

agent:
  preset: claude

proxy: "socks5://user:pass@host:port"
allowedUsers:
  - "12345"
  - "67890"
open: false

reaction:
  enabled: true
  emoji: "👍"

session:
  idleTimeoutMs: 86400000
  maxConcurrentUsers: 10

showThoughts: false
```

### Code Changes

**config.ts:**
1. Import `yaml` package:
   ```typescript
   import { parse as parseYaml } from "yaml";
   ```

2. Update `loadConfig()`:
   - Change default file name from `config.json` to `config.yaml`
   - Replace `JSON.parse(content)` with `parseYaml(content)`

**package.json:**
- Add dependency: `yaml`

### CLI Help Update

Update usage text to reference `config.yaml` instead of `config.json`.

## Success Criteria

- `pnpm run build` passes
- Bot starts with YAML config file
- All config fields properly parsed from YAML
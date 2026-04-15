# Telegram Agent CLI Entry Point Design

## Overview

Add a CLI entry point for telegram-agent package to enable running via `telegram-agent` command after installation.

## Scope

Single file CLI entry point - no command parsing, no parameters, just application bootstrap.

## Architecture

### File Structure

```
packages/telegram-agent/
├── src/
│   ├── bin/
│   │   └── cli.ts      # NEW - CLI entry point
│   └── index.ts        # Existing - development entry
├── dist/
│   └── bin/
│       │   └── cli.js  # Compiled CLI entry
└── package.json        # Modified - fix bin path
```

### Implementation

**src/bin/cli.ts**:
```typescript
import path from 'path';
import { bootstrap } from '@artusx/utils';

const ROOT_DIR = path.resolve(__dirname, '..');

bootstrap({
  root: ROOT_DIR,
  configDir: 'config'
});
```

Same logic as existing `src/index.ts`, but with adjusted path resolution to account for the extra `bin/` directory depth.

### package.json Changes

Current (incorrect):
```json
"bin": {
  "telegram-agent": "./dist/index.ts"
}
```

Updated:
```json
"bin": {
  "telegram-agent": "./dist/bin/cli.js"
}
```

## Usage

After `pnpm install`:
```bash
# Local development
pnpm run dev

# Via CLI (after build)
telegram-agent
```

## Testing

1. Run `pnpm run build` to compile
2. Verify `dist/bin/cli.js` exists
3. Run `node dist/bin/cli.js` to test entry point
4. Test global installation via `pnpm link --global`

## Design Decisions

- **Reuse bootstrap**: Same `@artusx/utils.bootstrap` pattern as existing entry point
- **No command framework**: Simple start-only CLI, no commander/yargs
- **Separate from index.ts**: Allows different runtime behaviors in future if needed
- **Fix existing bug**: Current bin points to .ts file (should be .js)

## Risks

- None significant - this is a straightforward addition
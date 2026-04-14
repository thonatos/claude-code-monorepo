# Claude Code Monorepo

A pnpm monorepo containing Telegram agent tools and a web application for stock analysis.

## Packages

| Package | Description |
|---------|-------------|
| [telegram-acp](packages/telegram-acp/README.md) | CLI tool: Bridge Telegram to ACP agents |
| [telegram-agent](packages/telegram-agent/README.md) | Service: ArtusX-based Telegram agent with webhook API |
| [web-app](packages/web-app/README.md) | React Router v7 web application |

See [Packages Architecture](docs/reference/packages-architecture.md) for detailed architecture.

## Development

```bash
# Install dependencies
pnpm install

# Code quality
pnpm run lint           # Check all packages
pnpm run lint:fix       # Auto-fix issues
pnpm run format         # Format code

# Build specific package
pnpm --filter <package> run build

# Run tests
pnpm --filter <package> run test
```

## Skills

Installed skills for extended capabilities. See [Skills Reference](docs/reference/skills.md).

## Security

- Secrets loaded from external config files (excluded via .gitignore)
- Pre-commit hooks: Gitleaks + Commitlint
- Biome for linting and formatting

## License

MIT
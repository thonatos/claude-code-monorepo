# Authentication Guide

## Token Configuration

Set webhook token in environment:

```bash
export TELEGRAM_WEBHOOK_TOKEN="your-secret-token"
```

Or in config file:

```yaml
webhook:
  token: "your-secret-token"
  enableAuth: true
```

## Using Token

Include token in request header:

```bash
curl -H "Authorization: Bearer your-secret-token" ...
```

## Disable Auth (Development)

In `config.development.ts`:

```typescript
webhook: {
  enableAuth: false,
}
```

## Security Best Practices

- Use strong, random tokens
- Never share tokens publicly
- Use environment variables in production
- Enable auth in production environment
- Rotate tokens periodically

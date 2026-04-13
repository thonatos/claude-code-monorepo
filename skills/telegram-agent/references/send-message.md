# Send Message Examples

## Basic Text Message

```bash
curl -X POST http://localhost:7001/api/telegram/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "text": "Hello from Telegram Agent!"
  }'
```

## HTML Formatting

```bash
curl -X POST http://localhost:7001/api/telegram/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "text": "<b>Bold</b> and <i>italic</i> text",
    "parseMode": "HTML"
  }'
```

## Markdown Formatting

```bash
curl -X POST http://localhost:7001/api/telegram/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "text": "**Bold** and _italic_ text",
    "parseMode": "Markdown"
  }'
```

## Response

```json
{
  "messageId": 42
}
```

The `messageId` can be used for subsequent operations like editing or reactions.

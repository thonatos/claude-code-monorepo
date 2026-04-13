# Send Reaction Examples

## Basic Reaction

```bash
curl -X POST http://localhost:7001/api/telegram/send-reaction \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "messageId": 42,
    "emoji": "👍"
  }'
```

## Common Emojis

- 👍 - Acknowledgment
- 🤔 - Thinking
- 🔧 - Processing
- ✅ - Complete
- 👀 - Watching
- 📤 - Sending
- 📥 - Receiving

## Response

```json
{
  "success": true
}
```

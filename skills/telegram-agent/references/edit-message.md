# Edit Message Examples

## Basic Edit

```bash
curl -X POST http://localhost:7001/api/telegram/edit-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "messageId": 42,
    "text": "Updated message text"
  }'
```

## Response

```json
{
  "messageId": 42
}
```

## Limitations

- Can only edit messages sent by the bot
- Cannot edit media messages
- Message must still exist (not deleted)

# Error Handling

## HTTP Status Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 401 | Unauthorized | Check token validity |
| 400 | Bad Request | Verify request parameters |
| 404 | Not Found | Check endpoint path |
| 500 | Server Error | Check logs, retry |

## Error Response Format

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authorization token"
}
```

## Common Errors

### 401 Unauthorized

**Cause:** Missing or invalid token

**Solution:**
- Include `Authorization: Bearer <token>` header
- Verify token matches config

### 400 Bad Request

**Cause:** Missing required parameters

**Solution:**
- Check all required fields (userId, text, etc.)
- Verify parameter types (string, number)

### 500 Internal Error

**Cause:** Bot not initialized or Telegram API error

**Solution:**
- Check bot token configuration
- Verify Telegram Bot API status
- Check application logs

# Send Media Examples

## Send Image

```bash
curl -X POST http://localhost:7001/api/telegram/send-media \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "filePath": "/tmp/screenshot.png",
    "type": "image"
  }'
```

## Send Audio

```bash
curl -X POST http://localhost:7001/api/telegram/send-media \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "filePath": "/tmp/recording.mp3",
    "type": "audio"
  }'
```

## Supported Formats

**Images:**
- JPEG, PNG, GIF, WebP

**Audio:**
- MP3, OGG, M4A, WAV

## Response

```json
{
  "messageId": 43
}
```

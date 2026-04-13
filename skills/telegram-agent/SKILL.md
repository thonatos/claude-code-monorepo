---
name: telegram-agent
description: Control Telegram Bot via HTTP webhook API to send messages, media, reactions, and more.
---

# Telegram Agent Skill

Control your Telegram Bot via webhook API.

## API Endpoint

- **Base URL**: `http://localhost:7001/api/telegram`
- **Authentication**: Bearer Token (see auth.md)
- **Content-Type**: `application/json`

## Available Operations

### Send Message
- **Endpoint**: `POST /send-message`
- **Parameters**:
  - `userId` (string): Telegram user ID
  - `text` (string): Message text
  - `parseMode` (optional): `HTML` or `Markdown`
- **Example**: See `references/send-message.md`

### Send Media
- **Endpoint**: `POST /send-media`
- **Parameters**:
  - `userId` (string): Telegram user ID
  - `filePath` (string): Local file path
  - `type` (string): `image` or `audio`
- **Example**: See `references/send-media.md`

### Edit Message
- **Endpoint**: `POST /edit-message`
- **Parameters**:
  - `userId` (string): Telegram user ID
  - `messageId` (number): Message ID to edit
  - `text` (string): New text
  - `parseMode` (optional): `HTML` or `Markdown`
- **Example**: See `references/edit-message.md`

### Send Reaction
- **Endpoint**: `POST /send-reaction`
- **Parameters**:
  - `userId` (string): Telegram user ID
  - `messageId` (number): Message ID
  - `emoji` (string): Emoji to send
- **Example**: See `references/send-reaction.md`

## Authentication

Set token in config or environment:

```bash
export TELEGRAM_WEBHOOK_TOKEN="your-secret-token"
```

Include in request:

```bash
curl -H "Authorization: Bearer your-secret-token" ...
```

See `references/auth.md` for details.

## Error Handling

See `references/errors.md` for error codes and handling.

## Quick Test

Use test script:

```bash
./scripts/test-webhook.sh send-message "123456" "Hello from skill!"
```

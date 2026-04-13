# Webhook API Reference

Complete API documentation for Telegram Agent webhook.

## Base URL

```
http://localhost:7001/api/telegram
```

## Authentication

All endpoints require Bearer token authentication (unless disabled in development):

```http
Authorization: Bearer <your-token>
```

## Common Headers

```http
Content-Type: application/json
Authorization: Bearer <token>
```

## Endpoints

### POST /send-message

Send text message to user.

**Request Body:**

```json
{
  "userId": "123456",
  "text": "Hello, this is a message",
  "parseMode": "HTML"
}
```

**Response:**

```json
{
  "messageId": 42
}
```

### POST /send-media

Send image or audio to user.

**Request Body:**

```json
{
  "userId": "123456",
  "filePath": "/tmp/screenshot.png",
  "type": "image"
}
```

**Response:**

```json
{
  "messageId": 43
}
```

### POST /edit-message

Edit existing message.

**Request Body:**

```json
{
  "userId": "123456",
  "messageId": 42,
  "text": "Updated message text",
  "parseMode": "HTML"
}
```

**Response:**

```json
{
  "messageId": 42
}
```

### POST /send-reaction

Send emoji reaction to message.

**Request Body:**

```json
{
  "userId": "123456",
  "messageId": 42,
  "emoji": "👍"
}
```

**Response:**

```json
{
  "success": true
}
```

## Status Codes

- `200`: Success
- `401`: Unauthorized (invalid or missing token)
- `400`: Bad Request (missing or invalid parameters)
- `500`: Internal Server Error

#!/bin/bash

# Test webhook endpoints

BASE_URL="http://localhost:7001/api/telegram"
TOKEN="your-secret-token"

send_message() {
  local userId="$1"
  local text="$2"
  
  curl -X POST "$BASE_URL/send-message" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"userId\": \"$userId\", \"text\": \"$text\"}"
}

send_media() {
  local userId="$1"
  local filePath="$2"
  local type="$3"
  
  curl -X POST "$BASE_URL/send-media" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"userId\": \"$userId\", \"filePath\": \"$filePath\", \"type\": \"$type\"}"
}

# Usage examples
case "$1" in
  send-message)
    send_message "$2" "$3"
    ;;
  send-media)
    send_media "$2" "$3" "$4"
    ;;
  *)
    echo "Usage: $0 {send-message|send-media} <userId> <text|path> [type]"
    ;;
esac

# Telegram Agent Message Flow

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant B as Bot API
    participant BR as Bridge
    participant ACP as ACP
    participant AG as Agent
    participant W as Webhook

    %% 1. User sends message
    rect rgb(244, 228, 193, 0.5)
        Note over U,B: 1. User sends message
        U->>B: SendMessage
        B->>BR: Webhook POST
    end

    %% 2. Ensure session and spawn agent
    rect rgb(232, 230, 227, 0.5)
        Note over BR,AG: 2. Ensure session and spawn agent
        BR->>BR: ensureConnection()
        BR->>+AG: spawn(command, args)
        BR->>ACP: acp.init()
        ACP->>AG: stdin/stdout (NDJSON)
    end

    %% 3. Send prompt to Agent
    rect rgb(244, 228, 193, 0.5)
        Note over BR,AG: 3. Send prompt to Agent
        BR->>BR: handleUserMessage()
        BR->>ACP: prompt(text)
        ACP->>AG: stdin.write()
    end

    %% 4. Agent processes and streams response
    rect rgb(232, 230, 227, 0.5)
        Note over ACP,AG: 4. Agent processes and streams response
        AG-->>ACP: stdout chunks
        AG-->>ACP: agent_message_chunk
        ACP-->>BR: sendMessage()
    end

    %% 5. Send response to User
    rect rgb(244, 228, 193, 0.5)
        Note over U,BR: 5. Send response to User
        BR-->>B: editMessage
        B-->>U: Message Update
    end
```

## Flow Description

| Step | Description |
|------|-------------|
| 1 | User sends message to Telegram Bot API via private chat |
| 2 | BridgeService ensures session exists and spawns Agent process |
| 3 | Prompt is sent to Agent through ACP stdin |
| 4 | Agent processes and streams response chunks via stdout |
| 5 | Response is sent back to User via Bot API |

## Components

| Actor | Module | Description |
|-------|--------|-------------|
| User | - | Telegram private chat user |
| Bot API | External | Telegram Cloud service |
| Bridge | module-bridge | Session management, connection orchestration |
| ACP | plugins/acp | Agent Client Protocol SDK |
| Agent | External | Claude Code spawned process |
| Webhook | module-web | HTTP endpoint for external API |
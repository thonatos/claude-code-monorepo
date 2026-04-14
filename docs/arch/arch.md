# Telegram Agent Architecture

```mermaid
flowchart TB
    subgraph USER["USER LAYER"]
        U["User<br/>Telegram Private Chat"]
    end

    subgraph EXTERNAL1["EXTERNAL"]
        BOT["Bot API<br/>Telegram Cloud"]
    end

    subgraph ENTRY["ENTRY POINT"]
        INDEX["index.ts<br/>Bootstrap"]
        LIFECYCLE["lifecycle.ts<br/>Hooks"]
        CONFIG["Config<br/>env"]
    end

    subgraph PLUGINS["PLUGINS"]
        TG["Telegram Plugin<br/>grammy Bot"]
        ACP["ACP Plugin<br/>SDK Client"]
    end

    subgraph CORE["CORE MODULES"]
        direction LR
        MB["module-bot<br/>BotService<br/>MsgHandler<br/>CmdHandler"]
        MBR["module-bridge<br/>BridgeService<br/>AgentProcess<br/>SessionMgr"]
        MW["module-web<br/>WebhookService<br/>Controller<br/>AuthMiddleware"]
        SVC["Services<br/>MediaHandler<br/>ReactionService<br/>AuthService"]
    end

    subgraph EXTERNAL2["EXTERNAL"]
        AG["Agent<br/>Claude Code Process"]
        API["API<br/>External HTTP"]
    end

    %% Connections
    U -->|"message"| BOT
    BOT -->|"webhook"| TG
    TG --> MB
    ACP --> MBR
    
    MB --> MBR
    MBR --> MW
    MW --> SVC
    
    MBR -->|"spawn"| AG
    MW -->|"HTTP"| API
    
    AG -.->|"NDJSON stream"| ACP
    MB -.->|"response"| BOT
    BOT -.->|"update"| U

    %% Styling
    classDef user fill:#a8c5e6,stroke:#4a4a4a,stroke-width:2px
    classDef external fill:#f4e4c1,stroke:#4a4a4a,stroke-width:2px,stroke-dasharray: 5 5
    classDef plugin fill:#9dd4c7,stroke:#4a4a4a,stroke-width:2px
    classDef core fill:#9dd4c7,stroke:#4a4a4a,stroke-width:2px
    classDef service fill:#e8e6e3,stroke:#4a4a4a,stroke-width:2px
    
    class U user
    class BOT,AG,API external
    class TG,ACP plugin
    class MB,MBR,MW core
    class SVC service
```

## Architecture Layers

| Layer | Components | Purpose |
|-------|------------|---------|
| USER | User | Telegram private chat interaction |
| EXTERNAL | Bot API, Agent, API | External services and spawned processes |
| ENTRY | index.ts, lifecycle.ts, Config | Application bootstrap and configuration |
| PLUGINS | Telegram, ACP | Protocol clients and SDK integrations |
| CORE | module-bot, module-bridge, module-web, Services | Business logic and service orchestration |

## Module Details

### module-bot
- `BotService` - Grammy bot instance management
- `MessageHandler` - User message processing
- `CommandHandler` - Bot command routing (/start, /help, /status)
- `AuthService` - User authorization validation

### module-bridge
- `BridgeService` - Session and connection orchestration
- `AgentProcessService` - Spawn and manage Agent child process
- `SessionManager` - User session state management

### module-web
- `WebhookService` - HTTP API for external integrations
- `Controller` - Request routing
- `AuthMiddleware` - API authentication

### Services
- `MediaHandler` - Photo/audio download and upload
- `ReactionService` - Telegram message reactions
- `AuthService` - Authorization checks

## Data Flow

```mermaid
flowchart LR
    %% Request Flow
    subgraph REQUEST["Request"]
        direction LR
        A["User Message"] --> B["Bot API"]
        B --> C["Webhook"]
        C --> D["Bridge"]
        D --> E["ACP"]
        E --> F["Agent stdin"]
    end

    %% Response Flow
    subgraph RESPONSE["Response"]
        direction LR
        G["Agent stdout"] --> H["ACP"]
        H --> I["Bridge"]
        I --> J["Bot API"]
        J --> K["User"]
    end

    REQUEST -.->|"NDJSON"| RESPONSE
```

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | ArtusX |
| Bot Client | Grammy |
| Agent Protocol | ACP SDK |
| Agent | Claude Code CLI |
| Language | TypeScript |
# Web App - Stock Analysis Reports

React Router v7 web application for displaying stock K-line analysis reports.

## Features

- Server-side rendering (SSR)
- Tailwind CSS v4 styling
- Dark/light theme toggle
- Stock report visualization
- Responsive design

## Quick Start

```bash
# Install dependencies
pnpm install

# Development server with HMR
pnpm run dev

# Production build
pnpm run build

# Production server
pnpm run start

# Type check
pnpm run typecheck
```

## Architecture

```
packages/web-app/
├── app/
│   ├── root.tsx             # Root layout with navigation
│   ├── routes.ts            # Route configuration
│   ├── app.css              # Global styles (Tailwind)
│   ├── routes/
│   │   ├── _index.tsx       # Home page
│   │   ├── about.tsx        # About page
│   │   └── report.tsx       # Stock report page
│   ├── components/
│   │   └── trading/         # Trading UI components
│   │       ├── Badge.tsx
│   │       ├── Card.tsx
│   │       ├── SignalItem.tsx
│   │       ├── ThemeToggle.tsx
│   │       └── index.ts
│   └── hooks/
│       └── useTheme.ts      # Theme management hook
├── public/                  # Static assets
│   └── favicon.ico
├── vite.config.ts           # Vite + Tailwind configuration
├── react-router.config.ts   # React Router config (SSR enabled)
└── tsconfig.json            # TypeScript config
```

## Pages

- `/` - Home page
- `/about` - About page
- `/report?symbol=AAPL&interval=1D` - Stock analysis report

## Deployment

### Docker

```bash
docker build -t web-app .
docker run -p 3000:3000 web-app
```

### Manual

Build and serve:

```bash
pnpm run build
pnpm run start
```

Built with React Router v7 and Tailwind CSS v4.
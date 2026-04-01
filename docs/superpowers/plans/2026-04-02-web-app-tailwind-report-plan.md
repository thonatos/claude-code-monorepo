# Web App Tailwind + Report 页面改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 report 页面从内联 CSS 迁移到 Tailwind CSS v4，并添加深色/浅色主题切换功能

**Architecture:** 创建可复用的 trading 组件库（Card、Badge、SignalItem 等），使用 Tailwind 工具类重构 report 页面，通过 data-theme 属性实现主题切换

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4 + react-router v7

---

### Task 1: 配置 Tailwind 主题变量

**Files:**
- Modify: `packages/web-app/app/app.css`

- [ ] **Step 1: 修改 app.css 添加主题变量**

```css
@import "tailwindcss";

/* Trading Terminal Theme */
@theme {
  --color-trading-bg-primary: #0a0e17;
  --color-trading-bg-secondary: #111827;
  --color-trading-bg-card: #1a2234;
  --color-trading-bg-elevated: #232d42;
  --color-trading-border: #2d3a52;
  --color-trading-text-primary: #f1f5f9;
  --color-trading-text-secondary: #94a3b8;
  --color-trading-text-muted: #64748b;
  --color-trading-green: #22c55e;
  --color-trading-green-dim: rgba(34, 197, 94, 0.15);
  --color-trading-red: #ef4444;
  --color-trading-red-dim: rgba(239, 68, 68, 0.15);
  --color-trading-amber: #f59e0b;
  --color-trading-amber-dim: rgba(245, 158, 11, 0.15);
  --color-trading-blue: #3b82f6;
  --color-trading-blue-dim: rgba(59, 130, 246, 0.15);
  --font-mono: "JetBrains Mono", monospace;
  --font-sans: "DM Sans", ui-sans-serif, system-ui, sans-serif;
}

/* Dark Theme (default) */
:root {
  --bg-primary: var(--color-trading-bg-primary);
  --bg-secondary: var(--color-trading-bg-secondary);
  --bg-card: var(--color-trading-bg-card);
  --bg-elevated: var(--color-trading-bg-elevated);
  --border: var(--color-trading-border);
  --text-primary: var(--color-trading-text-primary);
  --text-secondary: var(--color-trading-text-secondary);
  --text-muted: var(--color-trading-text-muted);
  --accent-green: var(--color-trading-green);
  --accent-green-dim: var(--color-trading-green-dim);
  --accent-red: var(--color-trading-red);
  --accent-red-dim: var(--color-trading-red-dim);
  --accent-amber: var(--color-trading-amber);
  --accent-amber-dim: var(--color-trading-amber-dim);
  --accent-blue: var(--color-trading-blue);
  --accent-blue-dim: var(--color-trading-blue-dim);
}

/* Light Theme */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-card: #ffffff;
  --bg-elevated: #f1f5f9;
  --border: #e2e8f0;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
}

/* Global Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-sans);
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 100vh;
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

- [ ] **Step 2: 提交**

```bash
git add app/app.css
git commit -m "feat: 添加 trading terminal 主题变量到 app.css"
```

---

### Task 2: 创建 Card 组件

**Files:**
- Create: `packages/web-app/app/components/trading/Card.tsx`

- [ ] **Step 1: 创建 Card 组件**

```tsx
import { ReactNode } from "react";

export interface CardProps {
  title?: string;
  icon?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, icon, children, className = "" }: CardProps) {
  return (
    <div className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center gap-2 px-6 py-5 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            {title}
          </span>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add app/components/trading/Card.tsx
git commit -m "feat: 创建 Card 卡片组件"
```

---

### Task 3: 创建 Badge 组件

**Files:**
- Create: `packages/web-app/app/components/trading/Badge.tsx`

- [ ] **Step 1: 创建 Badge 组件**

```tsx
import { ReactNode } from "react";

export type BadgeVariant = "buy" | "sell" | "wait" | "up" | "down" | "neutral";

export interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const variantStyles: Record<BadgeVariant, string> = {
  buy: "bg-[var(--accent-green-dim)] text-[var(--accent-green)]",
  sell: "bg-[var(--accent-red-dim)] text-[var(--accent-red)]",
  wait: "bg-[var(--accent-amber-dim)] text-[var(--accent-amber)]",
  up: "bg-[var(--accent-green-dim)] text-[var(--accent-green)]",
  down: "bg-[var(--accent-red-dim)] text-[var(--accent-red)]",
  neutral: "bg-[var(--accent-amber-dim)] text-[var(--accent-amber)]",
};

const sizeStyles: Record<"sm" | "md" | "lg", string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export function Badge({ variant, children, className = "", size = "md" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl font-bold uppercase tracking-wider ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add app/components/trading/Badge.tsx
git commit -m "feat: 创建 Badge 徽章组件"
```

---

### Task 4: 创建 SignalItem 组件

**Files:**
- Create: `packages/web-app/app/components/trading/SignalItem.tsx`

- [ ] **Step 1: 创建 SignalItem 组件**

```tsx
import { ReactNode } from "react";

export type SignalType = "bullish" | "bearish";

export interface SignalItemProps {
  type: SignalType;
  children: ReactNode;
}

export function SignalItem({ type, children }: SignalItemProps) {
  const isBullish = type === "bullish";

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-[var(--bg-primary)] rounded-xl text-sm">
      <span
        className={`flex-shrink-0 w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold ${
          isBullish
            ? "bg-[var(--accent-green-dim)] text-[var(--accent-green)]"
            : "bg-[var(--accent-red-dim)] text-[var(--accent-red)]"
        }`}
      >
        {isBullish ? "✓" : "✗"}
      </span>
      <span className="text-[var(--text-secondary)]">{children}</span>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add app/components/trading/SignalItem.tsx
git commit -m "feat: 创建 SignalItem 信号组件"
```

---

### Task 5: 创建 ThemeToggle 组件和 Hook

**Files:**
- Create: `packages/web-app/app/components/trading/ThemeToggle.tsx`
- Create: `packages/web-app/app/hooks/useTheme.ts`

- [ ] **Step 1: 创建 useTheme Hook**

```tsx
import { useState, useEffect } from "react";

export type Theme = "dark" | "light";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  return { theme, toggleTheme };
}
```

- [ ] **Step 2: 创建 ThemeToggle 组件**

```tsx
import { useTheme } from "../../hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      aria-label="切换主题"
    >
      {theme === "dark" ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add app/hooks/useTheme.ts app/components/trading/ThemeToggle.tsx
git commit -m "feat: 创建 ThemeToggle 组件和 useTheme Hook"
```

---

### Task 6: 创建组件导出文件

**Files:**
- Create: `packages/web-app/app/components/trading/index.ts`

- [ ] **Step 1: 创建导出文件**

```tsx
export { Card, type CardProps } from "./Card";
export { Badge, type BadgeVariant, type BadgeProps } from "./Badge";
export { SignalItem, type SignalType, type SignalItemProps } from "./SignalItem";
export { ThemeToggle } from "./ThemeToggle";
export { useTheme, type Theme } from "../../hooks/useTheme";
```

- [ ] **Step 2: 提交**

```bash
git add app/components/trading/index.ts
git commit -m "feat: 创建 trading 组件导出文件"
```

---

### Task 7: 更新 root.tsx 添加主题切换

**Files:**
- Modify: `packages/web-app/app/root.tsx`

- [ ] **Step 1: 修改 root.tsx**

```tsx
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { ThemeToggle } from "./components/trading";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="app min-h-screen">
          <nav className="navbar flex items-center justify-between gap-4 px-8 py-4 bg-[var(--bg-card)] border-b border-[var(--border)] mb-6">
            <div className="flex items-center gap-6">
              <a href="/" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                首页
              </a>
              <a href="/about" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                关于
              </a>
              <a href="/report?symbol=AAPL&interval=1D" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                报告示例
              </a>
            </div>
            <ThemeToggle />
          </nav>
          <main className="main-content">
            {children}
          </main>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add app/root.tsx
git commit -m "feat: 在 root 添加主题切换按钮"
```

---

### Task 8: 重构 report.tsx 使用 Tailwind 和组件

**Files:**
- Modify: `packages/web-app/app/routes/report.tsx`

- [ ] **Step 1: 重构 report.tsx**

```tsx
import { useLoaderData } from "react-router";
import type { Route } from "./+types/report";
import { Card, Badge, SignalItem } from "../components/trading";

// Types
interface ReportData {
  symbol: string;
  price: number;
  change: string;
  interval: string;
  datetime: string;
  trend: "上涨" | "下跌" | "震荡";
  action: "买入" | "卖出" | "观望";
  riskLevel: "低" | "中" | "高";
  support1: { price: number; note: string };
  support2: { price: number; note: string };
  resistance1: { price: number; note: string };
  resistance2: { price: number; note: string };
  bullishSignals: string[];
  bearishSignals: string[];
  entryCondition: string;
  stopLoss: number;
  takeProfit: number[];
  risks: string[];
  summary: string;
}

// Mock Data Generator
function generateReportData(symbol: string, interval: string, datetime: string): ReportData {
  const hash = symbol.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  const basePrice = 100 + (hash % 900);
  const changePercent = ((hash % 100) - 50) / 10;
  const isUp = changePercent > 0;

  const trend: ReportData["trend"] = changePercent > 2 ? "上涨" : changePercent < -2 ? "下跌" : "震荡";
  const action: ReportData["action"] = isUp ? "买入" : "观望";
  const riskLevel: ReportData["riskLevel"] = Math.abs(changePercent) > 5 ? "高" : Math.abs(changePercent) > 2 ? "中" : "低";

  return {
    symbol,
    price: basePrice,
    change: `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}%`,
    interval,
    datetime,
    trend,
    action,
    riskLevel,
    support1: { price: basePrice * 0.95, note: "20 日均线" },
    support2: { price: basePrice * 0.90, note: "60 日均线" },
    resistance1: { price: basePrice * 1.05, note: "前期高点" },
    resistance2: { price: basePrice * 1.10, note: "历史阻力位" },
    bullishSignals: ["MACD 金叉", "成交量放大"],
    bearishSignals: ["RSI 超买区域"],
    entryCondition: "突破阻力位后回踩确认",
    stopLoss: basePrice * 0.95,
    takeProfit: [basePrice * 1.05, basePrice * 1.10],
    risks: ["宏观经济不确定性", "行业政策变化"],
    summary: `${symbol} 在${interval} 周期下呈现${trend}趋势，建议${action}。关键支撑位$${(basePrice * 0.95).toFixed(2)}，阻力位$${(basePrice * 1.05).toFixed(2)}。`,
  };
}

// Loader
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") || "AAPL";
  const interval = url.searchParams.get("interval") || "1D";
  const datetime = url.searchParams.get("datetime") || new Date().toISOString();

  const data = generateReportData(symbol, interval, datetime);

  return { symbol, interval, datetime, data };
}

// Components
function Header({ data }: { data: ReportData }) {
  const changeStr = data.change;
  const priceClass = changeStr.startsWith("+")
    ? "text-[var(--accent-green)]"
    : changeStr.startsWith("-")
    ? "text-[var(--accent-red)]"
    : "text-[var(--accent-amber)]";
  const bgClass = changeStr.startsWith("+")
    ? "bg-[var(--accent-green-dim)]"
    : changeStr.startsWith("-")
    ? "bg-[var(--accent-red-dim)]"
    : "bg-[var(--accent-amber-dim)]";

  return (
    <header className="flex items-start justify-between p-8 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl mb-6">
      <div className="flex items-center gap-6">
        <div className="w-18 h-18 flex items-center justify-center bg-gradient-to-br from-[var(--accent-blue)] to-purple-500 rounded-2xl font-mono text-2xl font-bold text-white shadow-lg shadow-blue-500/30">
          {data.symbol}
        </div>
        <div>
          <h1 className="text-3xl font-extrabold mb-1">{data.symbol} 技术分析报告</h1>
          <div className="flex items-center gap-4 text-sm font-mono text-[var(--text-secondary)]">
            <span>⏱ {data.interval}</span>
            <span>📅 {data.datetime}</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-5xl font-bold leading-none mb-2">${data.price.toFixed(2)}</div>
        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-semibold ${bgClass} ${priceClass}`}>
          {changeStr.startsWith("+") ? "▲" : changeStr.startsWith("-") ? "▼" : "●"} {changeStr}
        </span>
      </div>
    </header>
  );
}

function ConclusionCard({ data }: { data: ReportData }) {
  const actionVariant = data.action === "买入" ? "buy" : data.action === "卖出" ? "sell" : "wait";
  const trendClass =
    data.trend === "上涨"
      ? "text-[var(--accent-green)]"
      : data.trend === "下跌"
      ? "text-[var(--accent-red)]"
      : "text-[var(--accent-amber)]";
  const riskVariant = data.riskLevel === "低" ? "buy" : data.riskLevel === "中" ? "wait" : "sell";

  return (
    <div className="bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl overflow-hidden mb-6">
      <div className="p-6 border-b border-[var(--border)]">
        <Badge variant={actionVariant as any} size="lg">
          {data.action === "买入" ? "↗" : data.action === "卖出" ? "↘" : "→"} {data.action}
        </Badge>
      </div>
      <div className="grid gap-4 p-6">
        <div className="flex justify-between items-center p-4 bg-[var(--bg-primary)] rounded-xl">
          <span className="text-sm text-[var(--text-muted)] font-medium">趋势判断</span>
          <span className={`font-mono font-semibold ${trendClass}`}>{data.trend}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-[var(--bg-primary)] rounded-xl">
          <span className="text-sm text-[var(--text-muted)] font-medium">风险等级</span>
          <Badge variant={riskVariant as any} size="sm">{data.riskLevel}</Badge>
        </div>
        <div className="flex justify-between items-center p-4 bg-[var(--bg-primary)] rounded-xl">
          <span className="text-sm text-[var(--text-muted)] font-medium">关键支撑</span>
          <span className="font-mono font-semibold">${data.support1.price.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-[var(--bg-primary)] rounded-xl">
          <span className="text-sm text-[var(--text-muted)] font-medium">关键阻力</span>
          <span className="font-mono font-semibold">${data.resistance1.price.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ data }: { data: ReportData }) {
  return (
    <Card title="📊 分析摘要">
      <p className="text-[var(--text-secondary)] leading-relaxed">{data.summary}</p>
    </Card>
  );
}

function KeyLevelsCard({ data }: { data: ReportData }) {
  const levels = [
    { type: "resistance", label: "阻力 2", price: data.resistance2.price, note: data.resistance2.note },
    { type: "resistance", label: "阻力 1", price: data.resistance1.price, note: data.resistance1.note },
    { type: "support", label: "支撑 1", price: data.support1.price, note: data.support1.note },
    { type: "support", label: "支撑 2", price: data.support2.price, note: data.support2.note },
  ];

  return (
    <Card title="🎯 关键价位">
      <div className="grid gap-3">
        {levels.map((level, i) => (
          <div
            key={i}
            className={`flex justify-between items-center p-4 bg-[var(--bg-primary)] rounded-xl border-l-3 ${
              level.type === "support"
                ? "border-l-[var(--accent-green)]"
                : "border-l-[var(--accent-red)]"
            }`}
          >
            <div>
              <div className="text-xs text-[var(--text-muted)] uppercase mb-1">{level.label}</div>
              <div className="font-mono font-semibold">${level.price.toFixed(2)}</div>
            </div>
            <span className="text-xs text-[var(--text-muted)]">{level.note}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SignalsCard({ data }: { data: ReportData }) {
  return (
    <Card title="📡 买卖信号">
      <div className="flex flex-col gap-2.5">
        {data.bullishSignals.map((signal, i) => (
          <SignalItem key={`bull-${i}`} type="bullish">{signal}</SignalItem>
        ))}
        {data.bearishSignals.map((signal, i) => (
          <SignalItem key={`bear-${i}`} type="bearish">{signal}</SignalItem>
        ))}
      </div>
    </Card>
  );
}

function RecommendationsCard({ data }: { data: ReportData }) {
  return (
    <Card title="💡 操作建议">
      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between items-start p-4 bg-[var(--bg-primary)] rounded-xl">
          <div>
            <div className="text-xs text-[var(--text-muted)] uppercase mb-1">入场时机</div>
            <div className="text-[var(--text-secondary)]">{data.entryCondition}</div>
          </div>
        </div>
        <div className="flex justify-between items-start p-4 bg-[var(--bg-primary)] rounded-xl">
          <div>
            <div className="text-xs text-[var(--text-muted)] uppercase mb-1">止损位置</div>
            <div className="font-mono font-semibold text-[var(--accent-blue)]">${data.stopLoss.toFixed(2)}</div>
          </div>
        </div>
        <div className="flex justify-between items-start p-4 bg-[var(--bg-primary)] rounded-xl">
          <div>
            <div className="text-xs text-[var(--text-muted)] uppercase mb-1">止盈目标</div>
            <div className="font-mono font-semibold text-[var(--accent-blue)]">
              {data.takeProfit.map((p) => `$${p.toFixed(2)}`).join(" → ")}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RisksCard({ data }: { data: ReportData }) {
  return (
    <Card title="⚠️ 风险提示">
      <div className="flex flex-col gap-2">
        {data.risks.map((risk, i) => (
          <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 bg-[var(--accent-amber-dim)] rounded-lg text-[var(--accent-amber)] text-sm">
            <span>⚠</span>
            <span>{risk}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ChartPlaceholder() {
  return (
    <div className="w-full h-96 bg-[var(--bg-elevated)] rounded-2xl flex items-center justify-center text-[var(--text-muted)]">
      <span className="text-lg">📈 K 线图表区域 (可接入真实图表库)</span>
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="mt-6 p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)] text-center">
      <strong className="text-[var(--text-secondary)]">免责声明：</strong>
      本报告仅基于技术分析，不构成投资建议。投资有风险，决策需谨慎。
    </div>
  );
}

// Main Component
export default function Report() {
  const { data } = useLoaderData<typeof loader>();

  return (
    <div className="report-page min-h-screen bg-[var(--bg-primary)] p-8">
      <div className="report-container max-w-7xl mx-auto">
        <Header data={data} />

        <div className="grid grid-cols-[320px_1fr_400px] gap-6 lg:grid-cols-1">
          {/* Left Sidebar */}
          <aside className="space-y-6">
            <ConclusionCard data={data} />
            <SummaryCard data={data} />
            <KeyLevelsCard data={data} />
          </aside>

          {/* Center - Chart */}
          <main>
            <ChartPlaceholder />
          </main>

          {/* Right Sidebar */}
          <aside className="space-y-6">
            <SignalsCard data={data} />
            <RecommendationsCard data={data} />
            <RisksCard data={data} />
          </aside>
        </div>

        <Disclaimer />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

```bash
pnpm --filter web-app build
```

预期：构建成功

- [ ] **Step 3: 提交**

```bash
git add app/routes/report.tsx
git commit -m "feat: 使用 Tailwind 和组件重构 report 页面"
```

---

### Task 9: 清理和最终验证

- [ ] **Step 1: 启动开发服务器**

```bash
pnpm --filter web-app dev
```

预期：开发服务器启动在 http://localhost:5173

- [ ] **Step 2: 验证功能**

访问以下 URL 验证：
- http://localhost:5173/report?symbol=AAPL&interval=1D - 显示报告
- 点击右上角主题切换按钮 - 深色/浅色主题切换正常
- 响应式布局 - 缩放窗口验证布局变化

- [ ] **Step 3: 构建验证**

```bash
pnpm --filter web-app build
```

预期：构建成功，无错误

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "chore: 完成 Tailwind 迁移和主题切换功能"
```

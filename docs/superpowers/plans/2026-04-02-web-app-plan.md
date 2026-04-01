# Web App (react-router v7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 `pnpx create-react-router` 在当前 monorepo 中创建一个基于 react-router v7 文件路由的展示型 web-app

**Architecture:** 使用 `pnpx create-react-router@latest` CLI 工具创建项目，然后修改页面和组件

**Tech Stack:** React 18 + TypeScript + react-router v7 + Vite

---

### Task 1: 使用 CLI 创建项目

**Files:**
- Create: `packages/web-app/` (整个目录由 CLI 生成)

- [ ] **Step 1: 运行 create-react-router 命令**

```bash
pnpx create-react-router@latest --template remix-run/react-router-templates/default web-app
```

预期：创建 `packages/web-app/` 目录，包含完整的项目结构

- [ ] **Step 2: 安装依赖**

```bash
cd packages/web-app && pnpm install
```

- [ ] **Step 3: 提交**

```bash
git add packages/web-app/
git commit -m "feat: 使用 create-react-router 初始化 web-app"
```

---

### Task 2: 修改根组件添加导航

**Files:**
- Modify: `packages/web-app/app/root.tsx`

- [ ] **Step 1: 修改 root.tsx 添加导航**

```typescript
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./root.css";

export default function App() {
  return (
    <html lang="zh-CN">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <div className="app">
          <nav className="navbar">
            <a href="/">首页</a>
            <a href="/about">关于</a>
          </nav>
          <main className="main-content">
            <Outlet />
          </main>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web-app/app/root.tsx
git commit -m "feat: 添加导航到根组件"
```

---

### Task 3: 修改首页内容

**Files:**
- Modify: `packages/web-app/app/routes/_index.tsx`

- [ ] **Step 1: 修改 _index.tsx**

```typescript
export default function Home() {
  return (
    <div className="home-page">
      <h1>欢迎访问</h1>
      <p>这是一个基于 react-router v7 的展示型应用。</p>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web-app/app/routes/_index.tsx
git commit -m "feat: 修改首页内容"
```

---

### Task 4: 创建关于页

**Files:**
- Create: `packages/web-app/app/routes/about.tsx`

- [ ] **Step 1: 创建 about.tsx**

```typescript
export default function About() {
  return (
    <div className="about-page">
      <h1>关于</h1>
      <p>这是一个使用 react-router v7 文件路由的应用。</p>
      <p>路由由 `app/routes/` 目录下的文件自动生成。</p>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web-app/app/routes/about.tsx
git commit -m "feat: 添加关于页路由"
```

---

### Task 5: 验证和清理

- [ ] **Step 1: 启动开发服务器验证**

```bash
pnpm --filter web-app dev
```

预期：开发服务器启动在 http://localhost:5173

- [ ] **Step 2: 验证路由**

访问以下 URL 确认路由正常工作：
- http://localhost:5173/ - 显示首页
- http://localhost:5173/about - 显示关于页

- [ ] **Step 3: 构建验证**

```bash
pnpm --filter web-app build
```

预期：构建成功

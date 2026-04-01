# Web App Tailwind + Report 页面改造设计

## 概述

将 web-app 的 report 页面从内联 CSS 迁移到 Tailwind CSS v4，并添加深色/浅色主题切换功能。

## 技术栈

| 项目 | 选择 |
|------|------|
| CSS 框架 | Tailwind CSS v4 |
| 主题 | 深色/浅色双主题切换 |
| 字体 | JetBrains Mono（数字）、DM Sans（正文） |

## 项目结构

```
packages/web-app/
├── app/
│   ├── app.css                 # Tailwind 配置 + 主题变量
│   ├── root.tsx                # 根组件（添加主题切换按钮）
│   ├── components/
│   │   └── trading/
│   │       ├── Card.tsx        # 卡片容器组件
│   │       ├── Badge.tsx       # 状态徽章组件
│   │       ├── SignalItem.tsx  # 信号项组件
│   │       └── ThemeToggle.tsx # 主题切换按钮
│   └── routes/
│       └── report.tsx          # 使用新组件重构
```

## 主题配置

### 深色主题（默认）

```css
:root {
  --bg-primary: #0a0e17;
  --bg-secondary: #111827;
  --bg-card: #1a2234;
  --bg-elevated: #232d42;
  --border: #2d3a52;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --accent-green: #22c55e;
  --accent-red: #ef4444;
  --accent-amber: #f59e0b;
  --accent-blue: #3b82f6;
}
```

### 浅色主题

```css
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-card: #ffffff;
  --bg-elevated: #f1f5f9;
  --border: #e2e8f0;
  --text-primary: #0f172a;
  --text-secondary: #475569;
}
```

## 组件设计

### Card 组件

```tsx
interface CardProps {
  title?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}
```

统一卡片样式：边框、圆角、背景、阴影。

### Badge 组件

```tsx
interface BadgeProps {
  variant: 'buy' | 'sell' | 'wait' | 'up' | 'down' | 'neutral';
  children: React.ReactNode;
}
```

状态徽章：买入（绿）、卖出（红）、观望（黄）。

### SignalItem 组件

```tsx
interface SignalItemProps {
  type: 'bullish' | 'bearish';
  children: React.ReactNode;
}
```

买卖信号项：绿色 ✓ 或红色 ✗ 图标。

### ThemeToggle 组件

```tsx
function ThemeToggle()
```

主题切换按钮：太阳/月亮图标切换。

## Report 页面改造

- 移除内联 CSS 字符串（约 500 行）
- 使用 Tailwind 工具类
- 使用 `dark:` 变体实现主题切换
- 使用 `grid`、`flex` 实现响应式布局
- 保留动态数据生成逻辑

### 布局结构

```
report.tsx
├── Header（标题 + 价格）
├── Main Grid（三栏布局）
│   ├── Left Sidebar
│   │   ├── ConclusionCard
│   │   ├── SummaryCard
│   │   └── KeyLevelsCard
│   ├── Center（图表区域）
│   └── Right Sidebar
│       ├── SignalsCard
│       ├── RecommendationsCard
│       └── RisksCard
└── Disclaimer
```

## 响应式断点

| 断点 | 布局 |
|------|------|
| `default` | 三栏布局（320px 1fr 400px） |
| `lg` (<1024px) | 两栏布局（侧边栏堆叠） |
| `sm` (<640px) | 单栏布局 |

## 命令

```bash
# 开发
pnpm --filter web-app dev

# 构建
pnpm --filter web-app build
```

## 后续扩展

- 添加更多交易分析组件
- 接入真实 K 线图表库
- 添加实时数据更新

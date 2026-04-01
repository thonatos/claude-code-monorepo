# Web App Design Spec

## 概述

在当前 monorepo 中创建一个基于 react-router v7 的展示型 web-app。

## 技术栈

| 项目 | 选择 |
|------|------|
| 框架 | React 18 + TypeScript |
| 路由 | react-router v7 (flatRoutes) |
| 构建 | Vite |
| 包管理 | pnpm/pnpx |

## 项目结构

```
packages/web-app/
├── app/
│   ├── routes.ts          # flatRoutes 入口（可选）
│   ├── root.tsx           # 根组件
│   └── routes/
│       ├── _index.tsx     # 首页 (/)
│       └── about.tsx      # 关于页 (/about)
├── index.html
└── package.json
```

## 路由配置

使用 react-router v7 的**文件路由（约定式路由）**：
- 路由由 `app/routes/` 目录下的文件自动生成
- 使用 `flatRoutes` 约定

## 路由约定

| 文件名 | 路径 | 说明 |
|--------|------|------|
| `_index.tsx` | `/` | 首页 |
| `about.tsx` | `/about` | 关于页 |
| `*.tsx` | `/*` | 文件即路由 |

## 命令

```bash
# 开发
pnpm --filter web-app dev

# 构建
pnpm --filter web-app build

# 预览
pnpm --filter web-app preview
```

## 后续扩展

- 添加更多页面时，在 `routes/` 下新建文件
- 添加嵌套路由：使用 `parent.child.tsx` 命名或文件夹方式
- 添加布局：创建 `layout.tsx` 文件

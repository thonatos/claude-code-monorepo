# README 文档命令修正设计

**Date:** 2026-03-29
**Author:** Claude
**Status:** Draft → Pending User Review

---

## 概述

修正 README.md 和 CLAUDE.md 中的 CLI 命令文档，区分"开发模式"和"安装后使用"两种场景。

---

## 问题

当前文档使用 `npx telegram-acp` 命令，但 `telegram-acp` 尚未发布到 npm，该命令无法工作。

---

## 解决方案

分场景说明运行方式：
- **开发模式**：在项目目录内使用 `pnpm --filter telegram-acp run start`
- **安装后使用**：通过 `pnpm link --global` 链接后，使用 `pnpx telegram-acp`

---

## 修改范围

| 文件 | 操作 |
|------|------|
| `README.md` | 修改 - 分场景说明运行方式 |
| `packages/telegram-acp/README.md` | 修改 - 同步更新 |
| `CLAUDE.md` | 修改 - 更新 CLI 命令示例 |

---

## 文档结构

### README.md 和 packages/telegram-acp/README.md

**Quick Start 部分：**

```markdown
## Quick Start

### 开发模式

在项目目录内开发运行：

```bash
pnpm install
pnpm --filter telegram-acp run build
pnpm --filter telegram-acp run start -- --preset claude
```

### 安装后使用

全局安装后可在任意目录运行：

```bash
# 构建并链接
cd packages/telegram-acp
pnpm run build
pnpm link --global

# 在任意目录运行
pnpx telegram-acp --preset claude
```
```

**CLI Commands 部分：**

```markdown
## CLI Commands

开发模式：

```bash
pnpm --filter telegram-acp run start -- --preset <name>    # 使用预设
pnpm --filter telegram-acp run start -- --config <file>    # 使用配置文件
pnpm --filter telegram-acp run start -- agents             # 列出可用预设
```

安装后：

```bash
pnpx telegram-acp --preset <name>    # 使用预设
pnpx telegram-acp --config <file>    # 使用配置文件
pnpx telegram-acp agents             # 列出可用预设
```
```

### CLAUDE.md

**CLI Commands 部分更新：**

```markdown
### CLI Commands

开发模式：
```bash
pnpm --filter telegram-acp run start -- --preset <name>
pnpm --filter telegram-acp run start -- --config <file>
pnpm --filter telegram-acp run start -- agents
```

安装后：
```bash
pnpx telegram-acp --preset <name>
pnpx telegram-acp --config <file>
pnpx telegram-acp agents
```
```

---

## 成功标准

- [ ] README.md Quick Start 分为"开发模式"和"安装后使用"
- [ ] README.md CLI Commands 分两组展示
- [ ] packages/telegram-acp/README.md 同步更新
- [ ] CLAUDE.md CLI 命令示例更新
- [ ] 所有命令可执行
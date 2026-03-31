# Screenshot Flow Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改进 SKILL.md 和 capture.md 截图流程文档，采用分步键盘操作模式

**Architecture:** 两层文档结构 - SKILL.md 为入口概览，capture.md 为详细指南

**Tech Stack:** Markdown 文档修改

---

## Files Structure

| 文件 | 操作 | 说明 |
|------|------|------|
| `.claude/skills/stock-kline-analysis/SKILL.md` | Modify | 修改"阶段 1：截图采集"部分 |
| `.claude/skills/stock-kline-analysis/references/capture.md` | Rewrite | 完全重写为分步操作指南 |

---

### Task 1: 修改 SKILL.md 阶段 1 部分

**Files:**
- Modify: `.claude/skills/stock-kline-analysis/SKILL.md:43-65`

- [ ] **Step 1: 替换"阶段 1：截图采集"内容**

将现有"键盘操作（一次性执行）"部分替换为分步流程描述：

```markdown
### 阶段 1：截图采集

**⚠️ 键盘优先 + 分步执行**：TradingView 支持全局键盘输入，使用分步操作便于状态检查和错误处理。

**操作流程**：

1. 创建数据目录 → `$ROOT_DIR/skills/stock-kline-analysis/scripts/create_dir.sh <symbol> <interval>`
2. 打开 TradingView 图表，等待加载（3秒）
3. **全屏模式**：Shift + F，等待 500ms
4. **状态检查**：获取 snapshot，如有弹窗遮挡则 ESC 关闭
5. **检查股票**：确认当前股票是否为目标，如不正确则输入代码 + Enter
6. **检查周期**：确认当前周期是否为目标，如不正确则输入分钟数 + Enter
7. 截图保存到目标路径
8. **关闭页面**：使用 `browser_tabs(action: "close")`

**周期分钟数**：`1`=1m, `5`=5m, `15`=15m, `30`=30m, `60`=1h, `120`=2h, `240`=4h, `1440`=D

详细步骤见 `references/capture.md`
```

- [ ] **Step 2: 验证修改正确**

确认 SKILL.md 中"阶段 1"部分已更新，其他部分保持不变。

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/stock-kline-analysis/SKILL.md
git commit -m "docs(skill): update screenshot capture flow to step-by-step mode"
```

---

### Task 2: 重写 capture.md

**Files:**
- Rewrite: `.claude/skills/stock-kline-analysis/references/capture.md`

- [ ] **Step 1: 重写 capture.md 全文**

用以下内容完全替换 capture.md：

```markdown
# 截图采集指南

阶段 1：使用 Playwright MCP 从 TradingView 采集 K 线图截图。

## ⚠️ 键盘优先 + 分步执行

**TradingView 支持全局键盘输入，无需点击按钮。**
**分步执行便于检查状态和处理异常。**

## TradingView 快捷键

| 操作 | 快捷键 | 说明 |
|------|--------|------|
| 全屏模式 | Shift + F | 进入/退出全屏，关闭 Strategy Report |
| 切换股票 | 字母键 + Enter | 直接输入代码，无需点击 |
| 切换周期 | 数字 + Enter | 输入分钟数，无需点击 |
| 关闭弹窗 | Escape | 关闭当前对话框 |

### 周期分钟数对照表

| 分钟数 | 周期 |
|--------|------|
| 1 | 1分钟 |
| 5 | 5分钟 |
| 15 | 15分钟 |
| 30 | 30分钟 |
| 60 | 1小时 |
| 120 | 2小时 |
| 240 | 4小时 |
| 1440 | 1天 |

## 分步流程

### 1. 创建数据目录

```bash
$ROOT_DIR/skills/stock-kline-analysis/scripts/create_dir.sh <symbol> <interval>
# 例如：$ROOT_DIR/skills/stock-kline-analysis/scripts/create_dir.sh AAPL 4h
# 输出：Created: data/analysis/2026-03-31-12-30-45-AAPL-4h/
```

### 2. 打开 TradingView

```javascript
mcp__playwright__browser_navigate(url: "https://www.tradingview.com/chart/")
mcp__playwright__browser_wait_for(time: 3)
```

### 3. 进入全屏模式

使用组合键 Shift + F：

```javascript
mcp__playwright__browser_run_code(
  code: async (page) => {
    await page.keyboard.down('Shift');
    await page.keyboard.press('F');
    await page.keyboard.up('Shift');
  }
)
mcp__playwright__browser_wait_for(time: 0.5)
```

### 4. 状态检查与弹窗处理

获取页面 snapshot，检查是否有遮挡：

```javascript
mcp__playwright__browser_snapshot()
```

检查 snapshot 中的关键信息：
- **弹窗遮挡**：是否有 `backdrop` 或 `overlap-manager-root` 元素
- **当前股票**：Page Title 或 toolbar button 中的代码
- **当前周期**：radiogroup 中 `[checked]` 的 radio

如有弹窗遮挡：

```javascript
mcp__playwright__browser_press_key('Escape')
mcp__playwright__browser_wait_for(time: 0.2)
// 再次 snapshot 检查
```

### 5. 检查并切换股票

检查当前股票是否为目标股票（从 Page Title 或 toolbar button 读取）。

如不正确，输入股票代码切换：

```javascript
mcp__playwright__browser_type(text: 'AAPL')  // 输入目标股票代码
mcp__playwright__browser_press_key('Enter')
mcp__playwright__browser_wait_for(time: 2)
```

### 6. 检查并切换周期

检查当前周期是否为目标周期（从 radiogroup 中 `[checked]` 的 radio 读取）。

如不正确，输入分钟数切换：

```javascript
mcp__playwright__browser_type(text: '240')  // 输入分钟数：240 = 4h
mcp__playwright__browser_press_key('Enter')
mcp__playwright__browser_wait_for(time: 1.5)
```

### 7. 截图保存

```javascript
mcp__playwright__browser_take_screenshot(
  filename: '$ROOT_DIR/data/analysis/{datetime}-{symbol}-{interval}/screenshot.jpg',
  type: 'jpeg'
)
```

### 8. 关闭页面

**正确方法**：
```javascript
mcp__playwright__browser_tabs(action: "close")
```

**错误方法**：
```javascript
mcp__playwright__browser_close()  // ❌ 会关闭所有页面
```

## 状态检查要点

每次 snapshot 后检查：

| 检查项 | 来源 | 说明 |
|--------|------|------|
| 弹窗遮挡 | backdrop / overlap-manager-root 元素 | 如存在则 ESC 关闭 |
| 当前股票 | Page Title / toolbar button | 如 "TSLA 364.44" |
| 当前周期 | radiogroup [checked] radio | 如 `radio "1 hour" [checked]` |
```

- [ ] **Step 2: 验证文件内容**

确认 capture.md 已重写，包含完整的分步流程和状态检查要点。

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/stock-kline-analysis/references/capture.md
git commit -m "docs(skill): rewrite capture guide with step-by-step keyboard flow"
```

---

## Self-Review Checklist

| 检查项 | 状态 |
|--------|------|
| SKILL.md 阶段 1 已更新为分步流程 | ✅ |
| capture.md 已完全重写 | ✅ |
| 周期分钟数对照表保留 | ✅ |
| 关闭页面方法正确（browser_tabs） | ✅ |
| 无 placeholder 或 TBD | ✅ |
# Stock K-Line Analysis 截图流程改进设计

## 概述

改进 SKILL.md 和 capture.md 中的截图采集流程，采用分步键盘操作模式，解决实际执行中遇到的弹窗遮挡、状态不明确等问题。

## 问题分析

### 当前流程问题

1. **弹窗遮挡** - 页面加载后可能有弹窗（如 Strategy Report、提示框），遮挡 UI 按钮，导致点击失败
2. **状态检查缺失** - 流程未明确要求检查当前股票/周期状态，可能重复操作或遗漏
3. **步骤描述模糊** - SKILL.md 的"键盘操作（一次性执行）"描述与 capture.md 的 `browser_run_code` 方案不一致
4. **错误处理缺失** - 未说明遇到遮挡时的处理方法

### 实际执行中的问题

- 页面加载后显示 TSLA（可能是之前的布局），而非空白状态
- 尝试点击 1h 周期按钮时，弹窗遮挡导致超时失败
- 需要手动 ESC 关闭弹窗后才能继续操作

## 设计方案

### 核心原则

| 原则 | 说明 |
|------|------|
| 键盘优先 | 全程使用键盘操作，避免点击 UI 按钮 |
| 状态检查 | 每步操作后检查页面状态，确认操作生效 |
| 弹窗处理 | 遇到弹窗遮挡时，用 ESC 关闭后重试 |
| 等待加载 | 关键操作后等待足够时间让图表加载 |

### 分步流程

```
步骤 1: 创建数据目录
        命令: $ROOT_DIR/skills/stock-kline-analysis/scripts/create_dir.sh <symbol> <interval>

步骤 2: 打开 TradingView
        工具: browser_navigate(url: "https://www.tradingview.com/chart/")
        等待: browser_wait_for(time: 3)

步骤 3: 进入全屏模式
        工具: browser_run_code（组合键需要用 run_code 执行）
        代码: keyboard.down('Shift') + press('F') + up('Shift')
        等待: 500ms（browser_wait_for: 0.5）

步骤 4: 状态检查与弹窗处理
        工具: browser_snapshot()
        检查: snapshot 中是否有 backdrop/弹窗遮挡元素
        处理: 如有遮挡 → browser_press_key('Escape') → 等待 200ms → 再次 snapshot 检查

步骤 5: 检查当前股票
        工具: browser_snapshot()
        检查: Page Title 或 toolbar button 中的股票代码
        判断: 是否为目标股票（如 TSLA）
        操作: 如不正确 → browser_type(text: '<股票代码>') → browser_press_key('Enter') → 等待 2秒

步骤 6: 检查当前周期
        工具: browser_snapshot()
        检查: radiogroup 中 checked 的 radio button（如 "1 hour" [checked]）
        判断: 是否为目标周期
        操作: 如不正确 → browser_type(text: '<分钟数>') → browser_press_key('Enter') → 等待 1.5秒
        周期映射: 1=1m, 5=5m, 15=15m, 30=30m, 60=1h, 120=2h, 240=4h, 1440=D

步骤 7: 截图保存
        工具: browser_take_screenshot(filename, type: 'jpeg')
        路径: $ROOT_DIR/data/analysis/{datetime}-{symbol}-{interval}/screenshot.jpg

步骤 8: 关闭页面
        工具: browser_tabs(action: "close")
        说明: 仅关闭当前 tab，不影响其他页面
```

### 快捷键操作方法

TradingView 支持全局键盘输入，以下操作无需点击按钮：

| 操作 | 实现方法 |
|------|----------|
| 全屏模式 | `keyboard.down('Shift')` + `press('F')` + `up('Shift')` |
| 切换股票 | 直接 `browser_type(text: 'AAPL')`，TradingView 自动触发搜索 |
| 确认选择 | `browser_press_key('Enter')` |
| 切换周期 | `browser_type(text: '60')` 输入分钟数 |
| 关闭弹窗 | `browser_press_key('Escape')` |

### 状态检查方法

使用 `browser_snapshot()` 获取页面结构，检查关键信息：

1. **股票代码检查**
   - 来源: Page Title（如 "TSLA 364.44"）
   - 或: toolbar button（如 `button "TSLA"`）

2. **周期检查**
   - 来源: radiogroup 中 `checked` 属性的 radio
   - 示例: `radio "1 hour" [checked]`

3. **弹窗遮挡检查**
   - 来源: snapshot 中 `backdrop` 类元素或 `overlap-manager-root` 子树
   - 处理: ESC 关闭后重新检查

## 文档修改清单

### SKILL.md 修改

修改"阶段 1：截图采集"部分，将"键盘操作（一次性执行）"替换为分步流程描述：

```markdown
### 阶段 1：截图采集

**⚠️ 键盘优先 + 分步执行**：TradingView 支持全局键盘输入，使用分步操作便于状态检查和错误处理。

**操作流程**：

1. 创建数据目录
2. 打开 TradingView 图表，等待加载（3秒）
3. **全屏模式**：Shift + F，等待 500ms
4. **状态检查**：获取 snapshot，如有弹窗遮挡则 ESC 关闭
5. **检查股票**：确认当前股票是否为目标，如不正确则输入代码 + Enter
6. **检查周期**：确认当前周期是否为目标，如不正确则输入分钟数 + Enter
7. 截图保存
8. **关闭页面**：使用 `browser_tabs(action: "close")`

详细步骤见 `references/capture.md`
```

### capture.md 修改

完全重写 capture.md，移除 `browser_run_code` 方式，改为分步操作指南：

```markdown
# 截图采集指南

阶段 1：使用 Playwright MCP 从 TradingView 采集 K 线图截图。

## ⚠️ 键盘优先 + 分步执行

**TradingView 支持全局键盘输入，无需点击按钮。**
**分步执行便于检查状态和处理异常。**

## 分步流程

### 1. 创建数据目录

```bash
$ROOT_DIR/skills/stock-kline-analysis/scripts/create_dir.sh <symbol> <interval>
```

### 2. 打开 TradingView

```javascript
mcp__playwright__browser_navigate(url: "https://www.tradingview.com/chart/")
mcp__playwright__browser_wait_for(time: 3)
```

### 3. 进入全屏模式

使用组合键 Shift + F：

```javascript
// 方法一：使用 run_code 执行组合键
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

检查当前股票是否为目标股票。如不正确：

```javascript
mcp__playwright__browser_type(text: 'AAPL')  // 输入目标股票代码
mcp__playwright__browser_press_key('Enter')
mcp__playwright__browser_wait_for(time: 2)
```

### 6. 检查并切换周期

检查当前周期是否为目标周期。如不正确：

```javascript
mcp__playwright__browser_type(text: '240')  // 输入分钟数：240 = 4h
mcp__playwright__browser_press_key('Enter')
mcp__playwright__browser_wait_for(time: 1.5)
```

**周期分钟数对照表**：

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

### 7. 截图保存

```javascript
mcp__playwright__browser_take_screenshot(
  filename: '$ROOT_DIR/data/analysis/.../screenshot.jpg',
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
| 弹窗遮挡 | backdrop 元素 | 如存在则 ESC 关闭 |
| 当前股票 | Page Title / toolbar button | 如 "TSLA 364.44" |
| 当前周期 | radiogroup [checked] radio | 如 `radio "1 hour" [checked]` |
```

## 周期分钟数对照表

保留现有对照表，无变化：

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

## 不涉及的部分

以下部分保持不变，不在本次修改范围：

- 阶段 2：技术分析（analyze.md）
- 阶段 3：报告生成（report.md）
- 预览报告流程
- 数据存储结构
- 指标说明
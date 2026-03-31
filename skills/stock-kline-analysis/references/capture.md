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
mcp__playwright__browser_navigate(url: "https://www.tradingview.com/chart/syIycOlQ/")
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
// 使用 run_code 输入文字（browser_type 无法直接在 TradingView 页面输入）
mcp__playwright__browser_run_code(
  code: async (page) => {
    await page.keyboard.type('AAPL');  // 输入目标股票代码
  }
)
mcp__playwright__browser_press_key('Enter')
mcp__playwright__browser_wait_for(time: 2)
```

### 6. 检查并切换周期

检查当前周期是否为目标周期（从 radiogroup 中 `[checked]` 的 radio 读取）。

如不正确，输入分钟数切换：

```javascript
// 使用 run_code 输入数字
mcp__playwright__browser_run_code(
  code: async (page) => {
    await page.keyboard.type('15');  // 输入分钟数：15 = 15m
  }
)
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
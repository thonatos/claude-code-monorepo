# 截图采集指南

阶段 1：使用 Playwright MCP 从 TradingView 采集 K 线图截图。

## ⚠️ 键盘优先原则

**TradingView 支持全局键盘输入，无需点击任何按钮。**

- ❌ 不要点击股票按钮、周期按钮
- ✓ 直接用键盘输入，TradingView 会自动触发搜索

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

## 完整流程

### 1. 创建数据目录

```bash
./scripts/create_dir.sh <symbol> <interval>
# 例如：./scripts/create_dir.sh AAPL 4h
# 输出：Created: data/analysis/2026-03-31-12-30-45-AAPL-4h/
```

### 2. 打开 TradingView

```javascript
mcp__playwright__browser_navigate(url: "https://www.tradingview.com/chart/")
mcp__playwright__browser_wait_for(time: 3)
```

### 3. 键盘一键操作（推荐）

**全屏 + 切换股票 + 切换周期 + 截图，一次性执行**：

```javascript
mcp__playwright__browser_run_code(
  code: async (page) => {
    // 1. 进入全屏模式（Shift+F）
    await page.keyboard.down('Shift');
    await page.keyboard.press('F');
    await page.keyboard.up('Shift');
    await page.waitForTimeout(500);

    // 2. 切换股票（股票代码 + Enter）
    await page.keyboard.type('QQQ');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // 3. 切换周期（分钟数 + Enter）
    await page.keyboard.type('240');  // 240 = 4h
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // 4. 截图
    await page.screenshot({
      path: 'data/analysis/2026-03-31-12-30-45-QQQ-4h/screenshot.jpg',
      type: 'jpeg',
      quality: 90
    });

    return 'Done';
  }
)
```

### 4. 关闭页面

截图完成后必须关闭页面：

```javascript
mcp__playwright__browser_tabs(action: "close")
```
# 截图采集指南

阶段 1：使用 Playwright MCP 从 TradingView 采集 K 线图截图。

## TradingView 快捷键

| 操作 | 快捷键 | 说明 |
|------|--------|------|
| 全屏模式 | Shift + F | 进入/退出全屏，关闭 Strategy Report |
| 切换股票 | 字母键 + Enter | 输入股票代码后按 Enter 确认 |
| 切换周期 | 数字 + Enter | 输入分钟数后按 Enter 确认 |
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
mcp__playwright__browser_navigate(url: "https://www.tradingview.com/chart/syIycOlQ/")
mcp__playwright__browser_wait_for(time: 3)
```

### 3. 全屏模式（关闭 Strategy Report）

```javascript
mcp__playwright__browser_press_key(key: "Shift+F")
mcp__playwright__browser_wait_for(time: 1)
```

### 4. 切换股票代码

```javascript
// 输入股票代码 + Enter 确认
mcp__playwright__browser_type(ref: "任意", text: "NVDA", submit: true)
mcp__playwright__browser_wait_for(time: 2)
```

### 5. 切换时间周期

```javascript
// 输入分钟数 + Enter 确认
// 240 = 4h, 60 = 1h
mcp__playwright__browser_type(ref: "任意", text: "240", submit: true)
mcp__playwright__browser_wait_for(time: 1.5)
```

### 6. 截图保存

```javascript
mcp__playwright__browser_take_screenshot(
    filename: "data/analysis/{datetime}-{symbol}-{interval}/screenshot.jpg",
    type: "jpeg"
)
```

## 一键脚本示例

```javascript
mcp__playwright__browser_run_code(
  code: async (page) => {
    // 1. 全屏模式关闭 Strategy Report
    await page.keyboard.press('Shift+F');
    await page.waitForTimeout(1000);

    // 2. 切换股票（股票代码 + Enter）
    await page.keyboard.type('NVDA', { delay: 100 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // 3. 切换周期（分钟数 + Enter）
    await page.keyboard.type('240', { delay: 100 });  // 240 = 4h
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // 4. 截图
    await page.screenshot({
      path: 'data/analysis/2026-03-31-12-30-45-NVDA-4h/screenshot.jpg',
      type: 'jpeg',
      quality: 90
    });

    return 'Done';
  }
)
```

## 注意事项

1. **登录状态**：TradingView 需保持登录状态才能访问个人布局
2. **图表加载**：切换后需等待图表完全加载再截图
3. **截图格式**：使用 JPG 格式（体积更小）
4. **全屏退出**：再次按 Shift + F 可退出全屏模式
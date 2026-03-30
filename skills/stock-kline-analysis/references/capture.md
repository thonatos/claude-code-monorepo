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

### 3. 进入全屏模式

**重要**：先进入全屏，确保图表最大化且 Strategy Report 关闭。

```javascript
// Shift+F 需要分开按下
mcp__playwright__browser_run_code(
  code: async (page) => {
    await page.keyboard.down('Shift');
    await page.keyboard.press('F');
    await page.keyboard.up('Shift');
  }
)
```

### 4. 切换股票代码

**推荐**：直接输入字母，无需点击按钮。

```javascript
mcp__playwright__browser_run_code(
  code: async (page) => {
    await page.keyboard.type('NVDA');  // 输入股票代码
    await page.keyboard.press('Enter');  // Enter 确认
  }
)
// 等待图表加载
mcp__playwright__browser_wait_for(time: 2)
```

### 5. 切换时间周期

**推荐**：输入分钟数，无需点击按钮。

```javascript
mcp__playwright__browser_run_code(
  code: async (page) => {
    await page.keyboard.type('240');  // 240 = 4h
    await page.keyboard.press('Enter');  // Enter 确认
  }
)
// 等待图表加载
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
    // 1. 进入全屏模式（Shift+F）
    await page.keyboard.down('Shift');
    await page.keyboard.press('F');
    await page.keyboard.up('Shift');
    await page.waitForTimeout(500);

    // 2. 切换股票（股票代码 + Enter）
    await page.keyboard.type('NVDA');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // 3. 切换周期（分钟数 + Enter）
    await page.keyboard.type('240');  // 240 = 4h
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // 4. 截图
    await page.screenshot({
      path: 'data/analysis/2026-03-31-12-30-45-NVDA-4h/screenshot.jpg',
      type: 'jpeg',
      quality: 90,
      fullPage: true
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
5. **关闭页面**：截图完成后关闭浏览器页面，避免资源占用

### 7. 关闭页面（可选）

截图完成后关闭浏览器页面：

```javascript
// 关闭当前 tab
mcp__playwright__browser_tabs(action: "close")
```

**说明**：这会关闭 TradingView tab，Playwright MCP 扩展页面会保留（这是正常的）。
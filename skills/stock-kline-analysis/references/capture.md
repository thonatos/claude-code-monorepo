# 截图采集指南

阶段 1：使用 Playwright MCP 从 TradingView 采集 K 线图截图。

## 1. 创建数据目录

使用辅助脚本：

```bash
./scripts/create_dir.sh <symbol> <interval>
# 例如：./scripts/create_dir.sh AAPL 4h
# 输出：Created: data/analysis/2026-03-30-AAPL-4h/
```

或手动创建：

```bash
date=$(date +%Y-%m-%d)
mkdir -p data/analysis/${date}-{symbol}-{interval}
```

## 2. 打开 TradingView

```javascript
mcp__playwright__browser_navigate(url: "https://www.tradingview.com/chart/syIycOlQ/")
mcp__playwright__browser_wait_for(time: 2)
```

## 3. Strategy Report 处理

页面可能打开 Strategy Report 窗口，遮挡 K 线图视野。

**检测方法**：获取页面快照，查找元素：
- `button "Open Strategy Report"` → 已最小化（正常状态）
- `button "Close Strategy Report"` / `button "Minimize panel"` → 需要最小化

**使用封装函数**（scripts/tradingview.js）：

```javascript
mcp__playwright__browser_run_code(
  code: async (page) => {
    const tv = require('./scripts/tradingview.js');
    await tv.minimizeStrategyReport(page);
  }
)
```

**手动操作**：

```javascript
// 获取快照检测状态
mcp__playwright__browser_snapshot()

// 如果检测到打开状态，点击最小化按钮
mcp__playwright__browser_click(ref: "Minimize panel button")
mcp__playwright__browser_wait_for(time: 1)
```

## 4. 切换股票代码

**使用封装函数**：

```javascript
mcp__playwright__browser_run_code(
  code: async (page) => {
    const tv = require('./scripts/tradingview.js');
    await tv.switchSymbol(page, "AAPL");
  }
)
```

**手动操作步骤**：
1. 点击图表上的股票名称按钮（如 "QQQ"）
2. 等待搜索框出现
3. 输入目标股票代码
4. 按 Enter 键提交搜索

```javascript
// 点击股票名称按钮
mcp__playwright__browser_click(ref: "股票名称按钮的 ref")
mcp__playwright__browser_wait_for(time: 1)

// 输入股票代码并提交
mcp__playwright__browser_type(ref: "搜索框 ref", text: "AAPL", submit: true)
mcp__playwright__browser_wait_for(time: 2)
```

## 5. 调整时间周期

默认使用 4h，可选：1m、5m、15m、1h、4h、D、W

**操作步骤**：
1. 点击周期选择器（如 "4h"、"D" 等）
2. 选择目标周期
3. 等待图表加载

```javascript
mcp__playwright__browser_click(ref: "周期按钮的 ref")
mcp__playwright__browser_wait_for(time: 1)
```

## 6. 截图保存

**使用封装函数**：

```javascript
mcp__playwright__browser_run_code(
  code: async (page) => {
    const tv = require('./scripts/tradingview.js');
    await tv.takeScreenshot(page, "data/analysis/2026-03-30-AAPL-4h/screenshot.jpg");
  }
)
```

**手动截图**：

```javascript
mcp__playwright__browser_wait_for(time: 2)  // 等待图表渲染
mcp__playwright__browser_take_screenshot(
    filename: "data/analysis/{date}-{symbol}-{interval}/screenshot.jpg",
    type: "jpeg",
    fullPage: false
)
```

## 注意事项

1. **登录状态**：TradingView 需保持登录状态才能访问个人布局
2. **图表加载**：切换股票后需等待图表完全加载再截图
3. **截图格式**：使用 JPG 格式（体积更小）
4. **Strategy Report**：每次打开页面必须检查此窗口状态
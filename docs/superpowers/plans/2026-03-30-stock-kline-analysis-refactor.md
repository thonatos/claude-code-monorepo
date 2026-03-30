# Stock K-Line Analysis Skill 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 stock-kline-analysis 技能拆分成模块化结构，SKILL.md 保持 60-70 行骨架，详细内容分离到 references/ 和 scripts/

**Architecture:** 三阶段结构 - 阶段 1 capture.md 处理截图采集，阶段 2 analyze.md 处理技术分析，阶段 3 report.md 处理报告生成。scripts/ 提供辅助工具（shell 脚本 + Playwright 封装 + TSX 报告生成器）

**Tech Stack:** Playwright MCP、bun（TSX 支持）、shell scripts

---

## File Structure

```
skills/stock-kline-analysis/
├── SKILL.md                 # 重构为骨架版本（60-70 行）
├── references/
│   ├── capture.md           # 新建 - 截图采集详细指南
│   ├── analyze.md           # 新建 - 技术分析方法论
│   └── report.md            # 新建 - 报告生成模板说明
└── scripts/
    ├── create_dir.sh        # 新建 - 创建数据目录脚本
    ├── serve_preview.sh     # 新建 - bun 静态服务器启动
    ├── tradingview.js       # 新建 - Playwright 操作封装
    └── report.tsx           # 新建 - TSX 报告生成器
```

---

## Task 1: 创建目录结构

**Files:**
- Create: `skills/stock-kline-analysis/references/`
- Create: `skills/stock-kline-analysis/scripts/`

- [ ] **Step 1: 创建 references 目录**

```bash
mkdir -p skills/stock-kline-analysis/references
```

- [ ] **Step 2: 创建 scripts 目录**

```bash
mkdir -p skills/stock-kline-analysis/scripts
```

- [ ] **Step 3: 验证目录结构**

```bash
ls -la skills/stock-kline-analysis/
```

Expected output: 显示 `references` 和 `scripts` 目录

- [ ] **Step 4: Commit**

```bash
git add skills/stock-kline-analysis/references skills/stock-kline-analysis/scripts
git commit -m "chore: create references and scripts directories for skill refactor"
```

---

## Task 2: 编写 capture.md

**Files:**
- Create: `skills/stock-kline-analysis/references/capture.md`

- [ ] **Step 1: 创建 capture.md 文件**

```markdown
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
```

- [ ] **Step 2: 写入文件**

将上述内容写入 `skills/stock-kline-analysis/references/capture.md`

- [ ] **Step 3: 验证文件**

```bash
wc -l skills/stock-kline-analysis/references/capture.md
```

Expected: 约 80-100 行

- [ ] **Step 4: Commit**

```bash
git add skills/stock-kline-analysis/references/capture.md
git commit -m "feat(skill): add capture.md reference for screenshot workflow"
```

---

## Task 3: 编写 analyze.md

**Files:**
- Create: `skills/stock-kline-analysis/references/analyze.md`

- [ ] **Step 1: 创建 analyze.md 文件**

```markdown
# 技术分析方法论

阶段 2：对 K 线图截图进行多维度技术分析。

## 分析维度

### 1. 价格走势识别

**当前趋势判断**：
- **上涨趋势**：价格沿均线向上，K 线以阳线为主，低点不断抬高
- **下跌趋势**：价格沿均线向下，K 线以阴线为主，高点不断降低
- **震荡整理**：价格在区间内波动，多空交替，方向不明

**价格形态识别**：
- **头肩顶/底**：重要反转信号，需要确认颈线突破
- **双顶/底**：重要支撑阻力确认，两个高点/低点接近
- **三角形整理**：收敛三角形预示变盘，扩张三角形波动加大
- **矩形整理**：区间震荡，等待突破方向

### 2. K 线形态分析

**单根 K 线解读**：
- **十字星**：多空平衡，可能转折信号
- **锤子线**：底部反转信号，实体小、下影线长
- **上吊线**：顶部反转信号，实体小、下影线长
- **大阳线**：强势上涨，实体大、无影线或短影线
- **大阴线**：强势下跌，实体大、无影线或短影线
- **吞没形态**：反转确认，前一根 K 线被完全包含

**关键参数**：
- **实体大小**：反映趋势力度，实体越大力度越强
- **上影线长度**：反映上方抛压，长上影线表明阻力强
- **下影线长度**：反映下方支撑，长下影线表明支撑强

### 3. 技术指标解读

#### Trend Ribbon（趋势带）
- **Bulls 区间**：多头区域价位
- **Bears 区间**：空头区域价位
- **判断逻辑**：
  - 价格在 Bulls 区间上方 → 多头偏向
  - 价格在 Bears 区间下方 → 空头偏向
  - 区间收紧 → 可能变盘

#### VRVP（成交量分布）
- **成交量集中区域**：关键价位（支撑/阻力）
- **量价配合**：价格上涨成交量放大 → 趋势健康
- **量价背离**：价格上涨成交量萎缩 → 可能反转

#### ATOM Bollinger（布林带）
- **价格位置判断**：
  - 上轨附近 → 超买区域
  - 中轨附近 → 正常波动
  - 下轨附近 → 超卖区域
- **布林带带宽**：
  - 带宽扩张 → 波动加大
  - 带宽收窄 → 变盘前兆

#### WaveTrend (SYWT)
- **WT 值**：多空区域判断
  - WT > 0 → 多头区域
  - WT < 0 → 空头区域
- **WT_SMA**：趋势平滑值，作为参考基准
- **WT_DIF**：WT 与 SMA 的差值
  - WT_DIF 正值大 → 上涨动能强
  - WT_DIF 负值大 → 下跌动能强

#### MCDX 资金流向
- **Retailer（散户）**：散户情绪指标，数值高表示情绪高涨
- **Hot Money（游资）**：短线活跃度，数值高表示游资参与
- **Banker（主力）**：机构动向，数值变化表示主力进出
- **判断逻辑**：
  - 散户情绪高涨 + 主力观望 → 警惕踩踏风险
  - 主力进场 + 游资活跃 → 可能启动

### 4. 关键价位识别

**支撑位来源**：
- 近期低点（日线/4小时线最低价）
- 布林带下轨价位
- VRVP 成交量集中区下沿
- 整数关口（如 $500、$100）

**阻力位来源**：
- 近期高点（日线/4小时线最高价）
- 布林带上轨价位
- VRVP 成交量集中区上沿
- 整数关口

### 5. 买卖信号综合判断

**多头信号清单**：
- 价格突破关键阻力
- Trend Ribbon 进入 Bulls 区间
- WaveTrend WT 转正
- 成交量放大配合上涨
- 主力资金进场
- K 线出现底部形态

**空头信号清单**：
- 价格跌破关键支撑
- Trend Ribbon 在 Bears 区间下方
- WaveTrend WT 转负
- 成交量放大配合下跌
- 散户情绪过热
- K 线出现顶部形态

**综合判断**：
对比多头信号和空头信号数量，结合权重（主力信号权重更高）得出倾向。

### 6. 风险评估

**技术风险**：
- 指标信号矛盾
- 假突破风险
- 超买/超卖极端状态

**市场风险**：
- 大盘整体走势
- 板块联动效应
- 突发事件影响

**操作风险**：
- 止损空间不足
- 仓位过大
- 情绪化交易

## 分析输出结构

分析完成后，提取以下关键信息用于报告生成：

```
{
  symbol: string,           // 股票代码
  price: number,            // 当前价格
  change: string,           // 涨跌幅
  interval: string,         // 分析周期
  datetime: string,         // 分析时间
  trend: '上涨'|'下跌'|'震荡',
  action: '买入'|'卖出'|'观望',
  riskLevel: '低'|'中'|'高',
  support1: { price, note },
  support2: { price, note },
  resistance1: { price, note },
  resistance2: { price, note },
  bullishSignals: string[],
  bearishSignals: string[],
  entryCondition: string,
  stopLoss: number,
  takeProfit: number[],
  risks: string[],
  summary: string
}
```
```

- [ ] **Step 2: 写入文件**

将上述内容写入 `skills/stock-kline-analysis/references/analyze.md`

- [ ] **Step 3: 验证文件**

```bash
wc -l skills/stock-kline-analysis/references/analyze.md
```

Expected: 约 120-150 行

- [ ] **Step 4: Commit**

```bash
git add skills/stock-kline-analysis/references/analyze.md
git commit -m "feat(skill): add analyze.md reference for technical analysis methodology"
```

---

## Task 4: 编写 report.md

**Files:**
- Create: `skills/stock-kline-analysis/references/report.md`

- [ ] **Step 1: 创建 report.md 文件**

```markdown
# 报告生成模板

阶段 3：根据分析结果生成报告。

## 报告原则

**结论优先**：快速结论放在最前面，详细分析在后，方便用户快速决策。

## Markdown 模板

```markdown
# [股票代码] K 线技术分析报告

## 快速结论

> **趋势判断**：[上涨/下跌/震荡]
> **操作建议**：[买入/卖出/观望]
> **关键价位**：支撑 [价位] | 阻力 [价位]
> **风险等级**：[低/中/高]

### 一句话总结
[用一句话概括当前技术面状态和操作建议]

---

## 基本信息

| 项目 | 数据 |
|------|------|
| 股票代码 | [CODE] |
| 当前价格 | [PRICE] |
| 涨跌幅 | [+/-XX%] |
| 分析周期 | [INTERVAL] |
| 分析时间 | [DATETIME] |

---

## 详细分析

[根据 analyze.md 分析结果填充]

---

## 关键价位

| 类型 | 价位 | 说明 |
|------|------|------|
| 支撑 1 | [价位] | [说明] |
| 支撑 2 | [价位] | [说明] |
| 阻力 1 | [价位] | [说明] |
| 阻力 2 | [价位] | [说明] |

---

## 买卖信号

### 多头信号 ✅
[列出多头信号]

### 空头信号 ❌
[列出空头信号]

---

## 操作建议

| 项目 | 建议 |
|------|------|
| 入场时机 | [建议] |
| 止损位置 | [价位] |
| 止盈目标 | [价位] |

---

## 风险提示

1. [技术风险]
2. [市场风险]
3. [操作风险]

---

**免责声明**：本报告仅基于技术分析，不构成投资建议。投资有风险，决策需谨慎。
```

## TSX 报告生成器

使用 bun 的 TSX 支持生成 HTML 报告，详见 `scripts/report.tsx`。

**数据结构定义**（ReportData 类型）：

```typescript
interface ReportData {
  symbol: string;
  price: number;
  change: string;
  interval: string;
  datetime: string;
  trend: '上涨' | '下跌' | '震荡';
  action: '买入' | '卖出' | '观望';
  riskLevel: '低' | '中' | '高';
  support1: { price: number; note: string };
  support2: { price: number; note: string };
  resistance1: { price: number; note: string };
  resistance2: { price: number; note: string };
  bullishSignals: string[];
  bearishSignals: string[];
  entryCondition: string;
  stopLoss: number;
  takeProfit: number[];
  risks: string[];
  summary: string;
}
```

**生成流程**：

1. 分析完成后，将结果保存为 `analysis_output.json`
2. 运行 TSX 生成器：

```bash
bun scripts/report.tsx \
  --input data/analysis/{date}-{symbol}-{interval}/analysis_output.json \
  --output data/analysis/{date}-{symbol}-{interval}/report.html
```

## 文件保存路径

```bash
# Markdown 报告
data/analysis/{date}-{symbol}-{interval}/report.md

# HTML 预览页面
data/analysis/{date}-{symbol}-{interval}/report.html

# 分析数据（中间产物）
data/analysis/{date}-{symbol}-{interval}/analysis_output.json
```

## 预览服务

使用 `scripts/serve_preview.sh` 启动静态服务器：

```bash
./scripts/serve_preview.sh
# 打开 http://localhost:3000/{date}-{symbol}-{interval}/report.html
```
```

- [ ] **Step 2: 写入文件**

将上述内容写入 `skills/stock-kline-analysis/references/report.md`

- [ ] **Step 3: 验证文件**

```bash
wc -l skills/stock-kline-analysis/references/report.md
```

Expected: 约 80-100 行

- [ ] **Step 4: Commit**

```bash
git add skills/stock-kline-analysis/references/report.md
git commit -m "feat(skill): add report.md reference for report generation templates"
```

---

## Task 5: 编写 create_dir.sh

**Files:**
- Create: `skills/stock-kline-analysis/scripts/create_dir.sh`

- [ ] **Step 1: 创建脚本文件**

```bash
#!/bin/bash
# 创建分析数据目录
# 用法: ./create_dir.sh <symbol> <interval>

symbol=${1:-QQQ}
interval=${2:-4h}
date=$(date +%Y-%m-%d)
dir="data/analysis/${date}-${symbol}-${interval}"

mkdir -p "$dir"
echo "Created: $dir"
```

- [ ] **Step 2: 写入文件**

将上述内容写入 `skills/stock-kline-analysis/scripts/create_dir.sh`

- [ ] **Step 3: 设置可执行权限**

```bash
chmod +x skills/stock-kline-analysis/scripts/create_dir.sh
```

- [ ] **Step 4: 测试脚本**

```bash
./skills/stock-kline-analysis/scripts/create_dir.sh TEST 1h
```

Expected output: `Created: data/analysis/2026-03-30-TEST-1h/`

- [ ] **Step 5: 验证目录创建**

```bash
ls -la data/analysis/2026-03-30-TEST-1h/
```

Expected: 目录存在

- [ ] **Step 6: 清理测试数据**

```bash
rm -rf data/analysis/2026-03-30-TEST-1h
```

- [ ] **Step 7: Commit**

```bash
git add skills/stock-kline-analysis/scripts/create_dir.sh
git commit -m "feat(skill): add create_dir.sh script for analysis directory creation"
```

---

## Task 6: 编写 serve_preview.sh

**Files:**
- Create: `skills/stock-kline-analysis/scripts/serve_preview.sh`

- [ ] **Step 1: 创建脚本文件**

```bash
#!/bin/bash
# 启动静态预览服务器
# 用法: ./serve_preview.sh

PORT=3000

# 检测 bun 是否安装
if ! command -v bun &> /dev/null; then
    echo "bun not found. Please install bun:"
    echo "  curl -fsSL https://bun.sh/install | bash"
    echo "  or visit: https://bun.sh"
    exit 1
fi

echo "Starting preview server on port $PORT..."
echo "Open: http://localhost:$PORT/{date}-{symbol}-{interval}/report.html"
bun x serve data/analysis -l $PORT
```

- [ ] **Step 2: 写入文件**

将上述内容写入 `skills/stock-kline-analysis/scripts/serve_preview.sh`

- [ ] **Step 3: 设置可执行权限**

```bash
chmod +x skills/stock-kline-analysis/scripts/serve_preview.sh
```

- [ ] **Step 4: 测试脚本（检测 bun）**

```bash
./skills/stock-kline-analysis/scripts/serve_preview.sh &
sleep 2
kill $!
```

Expected: 如果 bun 已安装，输出 "Starting preview server..."

- [ ] **Step 5: Commit**

```bash
git add skills/stock-kline-analysis/scripts/serve_preview.sh
git commit -m "feat(skill): add serve_preview.sh script for bun static server"
```

---

## Task 7: 编写 tradingview.js

**Files:**
- Create: `skills/stock-kline-analysis/scripts/tradingview.js`

- [ ] **Step 1: 创建 JavaScript 文件**

```javascript
/**
 * TradingView Playwright 操作封装
 * 用于 mcp__playwright__browser_run_code 调用
 */

/**
 * 最小化 Strategy Report 窗口
 * @param {Page} page - Playwright page 对象
 */
async function minimizeStrategyReport(page) {
  try {
    // 检测是否有最小化按钮
    const minimizeBtn = page.locator('button').filter({
      hasText: /minimize|collapse|close strategy/i
    }).first();

    const isVisible = await minimizeBtn.isVisible().catch(() => false);

    if (isVisible) {
      await minimizeBtn.click();
      await page.waitForTimeout(1000);
      console.log('Strategy Report minimized');
    } else {
      console.log('Strategy Report already minimized');
    }
  } catch (error) {
    console.log('Strategy Report check skipped:', error.message);
  }
}

/**
 * 切换股票代码
 * @param {Page} page - Playwright page 对象
 * @param {string} symbol - 目标股票代码（如 AAPL、TSLA）
 */
async function switchSymbol(page, symbol) {
  try {
    // 点击股票名称按钮打开搜索
    const symbolBtn = page.locator('[data-symbol], .symbol-name, button').filter({
      hasText: /^[A-Z]{1,5}$/
    }).first();

    await symbolBtn.click();
    await page.waitForTimeout(500);

    // 输入股票代码
    const searchbox = page.getByRole('searchbox').or(
      page.locator('input[type="text"]').first()
    );

    await searchbox.fill(symbol);
    await searchbox.press('Enter');
    await page.waitForTimeout(2000);

    console.log(`Switched to ${symbol}`);
  } catch (error) {
    console.error('Symbol switch failed:', error.message);
    throw error;
  }
}

/**
 * 截图保存
 * @param {Page} page - Playwright page 对象
 * @param {string} outputPath - 输出文件路径
 */
async function takeScreenshot(page, outputPath) {
  await page.waitForTimeout(2000); // 等待图表渲染

  await page.screenshot({
    path: outputPath,
    type: 'jpeg',
    quality: 90,
    scale: 'css'
  });

  console.log(`Screenshot saved: ${outputPath}`);
}

/**
 * 调整时间周期
 * @param {Page} page - Playwright page 对象
 * @param {string} interval - 时间周期（如 4h、D、W）
 */
async function setInterval(page, interval) {
  try {
    // 点击周期选择器
    const intervalBtn = page.locator('button').filter({
      hasText: /^(4h|1h|D|W|M|15m|5m|1m)$/
    }).first();

    await intervalBtn.click();
    await page.waitForTimeout(500);

    // 选择目标周期
    const targetBtn = page.getByRole('button', { name: interval });
    await targetBtn.click();
    await page.waitForTimeout(1500);

    console.log(`Interval set to ${interval}`);
  } catch (error) {
    console.error('Interval change failed:', error.message);
    throw error;
  }
}

// 导出函数
module.exports = {
  minimizeStrategyReport,
  switchSymbol,
  takeScreenshot,
  setInterval
};
```

- [ ] **Step 2: 写入文件**

将上述内容写入 `skills/stock-kline-analysis/scripts/tradingview.js`

- [ ] **Step 3: 验证语法**

```bash
node --check skills/stock-kline-analysis/scripts/tradingview.js
```

Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add skills/stock-kline-analysis/scripts/tradingview.js
git commit -m "feat(skill): add tradingview.js for Playwright operations封装"
```

---

## Task 8: 编写 report.tsx

**Files:**
- Create: `skills/stock-kline-analysis/scripts/report.tsx`

- [ ] **Step 1: 创建 TSX 文件**

```tsx
/**
 * TSX 报告生成器
 * 使用 bun 直接运行：bun report.tsx --input analysis_output.json --output report.html
 */

interface ReportData {
  symbol: string;
  price: number;
  change: string;
  interval: string;
  datetime: string;
  trend: '上涨' | '下跌' | '震荡';
  action: '买入' | '卖出' | '观望';
  riskLevel: '低' | '中' | '高';
  support1: { price: number; note: string };
  support2: { price: number; note: string };
  resistance1: { price: number; note: string };
  resistance2: { price: number; note: string };
  bullishSignals: string[];
  bearishSignals: string[];
  entryCondition: string;
  stopLoss: number;
  takeProfit: number[];
  risks: string[];
  summary: string;
}

// CSS 样式
const styles = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
.container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
h1 { color: #1a1a1a; border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
.conclusion { background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 30px; }
.conclusion h2 { margin-bottom: 15px; }
.conclusion-box { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
.conclusion-item { padding: 10px; background: white; border-radius: 4px; }
.conclusion-item strong { color: #007bff; }
.summary { font-size: 1.1em; padding: 15px; background: #e7f3ff; border-radius: 4px; margin-top: 15px; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
th { background: #f8f9fa; font-weight: 600; }
.screenshot { width: 100%; border-radius: 6px; margin: 20px 0; }
.section { margin: 25px 0; }
.section h2 { color: #1a1a1a; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
.bullish { color: #28a745; }
.bearish { color: #dc3545; }
.disclaimer { font-size: 0.85em; color: #666; padding: 15px; background: #f8f9fa; border-radius: 4px; margin-top: 30px; }
ul { margin: 10px 0 10px 20px; }
`;

// 组件函数
function Container({ children }: { children: any }) {
  return <div class="container">{children}</div>;
}

function Conclusion({ data }: { data: ReportData }) {
  return (
    <div class="conclusion">
      <h2>快速结论</h2>
      <div class="conclusion-box">
        <div class="conclusion-item"><strong>趋势判断：</strong>{data.trend}</div>
        <div class="conclusion-item"><strong>操作建议：</strong>{data.action}</div>
        <div class="conclusion-item"><strong>关键支撑：</strong>${data.support1.price}</div>
        <div class="conclusion-item"><strong>关键阻力：</strong>${data.resistance1.price}</div>
        <div class="conclusion-item"><strong>风险等级：</strong>{data.riskLevel}</div>
        <div class="conclusion-item"><strong>分析周期：</strong>{data.interval}</div>
      </div>
      <div class="summary">{data.summary}</div>
    </div>
  );
}

function BasicInfo({ data }: { data: ReportData }) {
  return (
    <div class="section">
      <h2>基本信息</h2>
      <table>
        <tr><th>股票代码</th><td>{data.symbol}</td></tr>
        <tr><th>当前价格</th><td>${data.price}</td></tr>
        <tr><th>涨跌幅</th><td>{data.change}</td></tr>
        <tr><th>分析时间</th><td>{data.datetime}</td></tr>
      </table>
    </div>
  );
}

function KeyLevels({ data }: { data: ReportData }) {
  return (
    <div class="section">
      <h2>关键价位</h2>
      <table>
        <tr><th>类型</th><th>价位</th><th>说明</th></tr>
        <tr><td>支撑 1</td><td>${data.support1.price}</td><td>{data.support1.note}</td></tr>
        <tr><td>支撑 2</td><td>${data.support2.price}</td><td>{data.support2.note}</td></tr>
        <tr><td>阻力 1</td><td>${data.resistance1.price}</td><td>{data.resistance1.note}</td></tr>
        <tr><td>阻力 2</td><td>${data.resistance2.price}</td><td>{data.resistance2.note}</td></tr>
      </table>
    </div>
  );
}

function Signals({ data }: { data: ReportData }) {
  return (
    <div class="section">
      <h2>买卖信号</h2>
      <h3 class="bullish">多头信号 ✅</h3>
      <ul>
        {data.bullishSignals.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
      <h3 class="bearish">空头信号 ❌</h3>
      <ul>
        {data.bearishSignals.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}

function Recommendations({ data }: { data: ReportData }) {
  return (
    <div class="section">
      <h2>操作建议</h2>
      <table>
        <tr><th>项目</th><th>建议</th></tr>
        <tr><td>入场时机</td><td>{data.entryCondition}</td></tr>
        <tr><td>止损位置</td><td>${data.stopLoss}</td></tr>
        <tr><td>止盈目标</td><td>{data.takeProfit.map(p => `$${p}`).join(' / ')}</td></tr>
      </table>
    </div>
  );
}

function Risks({ data }: { data: ReportData }) {
  return (
    <div class="section">
      <h2>风险提示</h2>
      <ul>
        {data.risks.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </div>
  );
}

function Disclaimer() {
  return (
    <div class="disclaimer">
      <strong>免责声明</strong>：本报告仅基于技术分析，不构成投资建议。投资有风险，决策需谨慎。
    </div>
  );
}

function Report({ data }: { data: ReportData }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{data.symbol} K 线技术分析报告</title>
        <style>{styles}</style>
      </head>
      <body>
        <Container>
          <h1>{data.symbol} K 线技术分析报告</h1>
          <Conclusion data={data} />
          <img src="screenshot.jpg" alt="K 线图截图" class="screenshot" />
          <BasicInfo data={data} />
          <KeyLevels data={data} />
          <Signals data={data} />
          <Recommendations data={data} />
          <Risks data={data} />
          <Disclaimer />
        </Container>
      </body>
    </html>
  );
}

// CLI 入口
const args = Bun.argv.slice(2);
const inputPath = args.find(a => a.startsWith('--input='))?.split('=')[1] || 'analysis_output.json';
const outputPath = args.find(a => a.startsWith('--output='))?.split('=')[1] || 'report.html';

// 读取数据
const data = await Bun.file(inputPath).json() as ReportData;

// 生成 HTML
const html = <Report data={data} />;
await Bun.write(outputPath, html.toString());

console.log(`Report generated: ${outputPath}`);
```

- [ ] **Step 2: 写入文件**

将上述内容写入 `skills/stock-kline-analysis/scripts/report.tsx`

- [ ] **Step 3: 创建测试数据**

```json
{
  "symbol": "TEST",
  "price": 100.00,
  "change": "+1.5%",
  "interval": "4h",
  "datetime": "2026-03-30 12:00",
  "trend": "震荡",
  "action": "观望",
  "riskLevel": "中",
  "support1": { "price": 95, "note": "近期低点" },
  "support2": { "price": 90, "note": "布林带下轨" },
  "resistance1": { "price": 105, "note": "近期高点" },
  "resistance2": { "price": 110, "note": "布林带上轨" },
  "bullishSignals": ["下影线较长", "成交量平稳"],
  "bearishSignals": ["Trend Ribbon 偏空", "方向不明"],
  "entryCondition": "突破 $105 后入场",
  "stopLoss": 90,
  "takeProfit": [105, 110],
  "risks": ["震荡行情风险", "假突破风险"],
  "summary": "TEST 当前震荡整理，建议观望等待突破信号"
}
```

写入到 `data/analysis/test-analysis_output.json`

- [ ] **Step 4: 测试 TSX 生成**

```bash
bun skills/stock-kline-analysis/scripts/report.tsx \
  --input=data/analysis/test-analysis_output.json \
  --output=data/analysis/test-report.html
```

Expected: 输出 "Report generated: data/analysis/test-report.html"

- [ ] **Step 5: 验证 HTML 内容**

```bash
head -20 data/analysis/test-report.html
```

Expected: 包含 `<html lang="zh-CN">` 和 `<title>TEST K 线技术分析报告</title>`

- [ ] **Step 6: 清理测试数据**

```bash
rm -f data/analysis/test-analysis_output.json data/analysis/test-report.html
```

- [ ] **Step 7: Commit**

```bash
git add skills/stock-kline-analysis/scripts/report.tsx
git commit -m "feat(skill): add report.tsx for TSX-based HTML report generation"
```

---

## Task 9: 重构 SKILL.md

**Files:**
- Modify: `skills/stock-kline-analysis/SKILL.md`

- [ ] **Step 1: 备份原 SKILL.md**

```bash
cp skills/stock-kline-analysis/SKILL.md skills/stock-kline-analysis/SKILL.md.bak
```

- [ ] **Step 2: 重写 SKILL.md 为骨架版本**

```markdown
---
name: stock-kline-analysis
description: 分析美股 K 线图走势并生成详细报告。使用 TradingView 网站获取实时数据，通过截图分析技术指标、趋势方向、关键价位和买卖信号。当用户询问股票分析、技术分析、K线解读、趋势判断、买卖建议时触发此技能。
---

# Stock K-Line Analysis Skill

使用 TradingView 对美股进行技术分析，生成详细的分析报告。

## 数据存储

所有分析数据存储在：

```
data/analysis/{YYYY-MM-DD}-{symbol}-{interval}/
├── screenshot.jpg       # K 线图截图
├── analysis_output.json # 分析数据（中间产物）
├── report.md            # Markdown 分析报告
└── report.html          # HTML 预览页面
```

**注意**：`data/` 目录已添加到 `.gitignore`，不应提交到版本控制。

## 工作流程（三阶段）

### 阶段 1：截图采集

详细步骤见 `references/capture.md`：

1. 创建数据目录 → `scripts/create_dir.sh`
2. 打开 TradingView 图表
3. 检查并最小化 Strategy Report → `scripts/tradingview.js`
4. 切换目标股票代码
5. 调整时间周期（默认 4h）
6. 截图保存

### 阶段 2：技术分析

详细方法见 `references/analyze.md`：

读取截图，进行多维度分析：
- K 线形态分析
- 技术指标解读
- 关键价位识别
- 买卖信号综合判断
- 风险评估

### 阶段 3：报告生成

详细模板见 `references/report.md`：

1. 按模板生成 Markdown 报告（结论优先）
2. 使用 `scripts/report.tsx` 生成 HTML 预览页面
3. 提示用户预览路径

## 预览报告

使用 `scripts/serve_preview.sh` 启动静态服务器：

```bash
./scripts/serve_preview.sh
# 打开 http://localhost:3000/{date}-{symbol}-{interval}/report.html
```

## 使用示例

- "分析一下 AAPL 的走势"
- "帮我看看 TSLA 的 K 线图"
- "QQQ 现在是什么趋势？"
- "NVDA 的技术指标怎么样？"

## 指标说明

根据 TradingView 个人布局可能包含的指标：
- VRVP (Visible Range Volume Profile)：成交量分布
- Zig Zag：之字形指标，识别重要转折点
- Trend Ribbon：趋势带，显示多空区间
- ATOM Bollinger：布林带变体
- SYWT (WaveTrend Strategy)：波浪趋势策略指标
- SYMCDX (MCDX)：综合动量指标

详细解读方法见 `references/analyze.md`。
```

- [ ] **Step 3: 写入文件**

将上述内容写入 `skills/stock-kline-analysis/SKILL.md`

- [ ] **Step 4: 验证行数**

```bash
wc -l skills/stock-kline-analysis/SKILL.md
```

Expected: 60-70 行

- [ ] **Step 5: 删除备份文件**

```bash
rm skills/stock-kline-analysis/SKILL.md.bak
```

- [ ] **Step 6: Commit**

```bash
git add skills/stock-kline-analysis/SKILL.md
git commit -m "refactor(skill): restructure SKILL.md to skeleton version with references"
```

---

## Task 10: 最终验证与提交

- [ ] **Step 1: 验证目录结构**

```bash
find skills/stock-kline-analysis -type f | sort
```

Expected output:
```
skills/stock-kline-analysis/SKILL.md
skills/stock-kline-analysis/references/analyze.md
skills/stock-kline-analysis/references/capture.md
skills/stock-kline-analysis/references/report.md
skills/stock-kline-analysis/scripts/create_dir.sh
skills/stock-kline-analysis/scripts/report.tsx
skills/stock-kline-analysis/scripts/serve_preview.sh
skills/stock-kline-analysis/scripts/tradingview.js
```

- [ ] **Step 2: 验证 SKILL.md 行数**

```bash
wc -l skills/stock-kline-analysis/SKILL.md
```

Expected: 60-70 行

- [ ] **Step 3: 验证所有 scripts 可执行**

```bash
ls -la skills/stock-kline-analysis/scripts/
```

Expected: create_dir.sh 和 serve_preview.sh 有可执行权限 (x)

- [ ] **Step 4: 运行最终 commit**

```bash
git status
git add -A
git commit -m "feat(skill): complete stock-kline-analysis refactor with modular structure"
```

---

## Spec Coverage Check

| Spec 要求 | Task |
|-----------|------|
| SKILL.md 60-70 行 | Task 9 |
| references/capture.md | Task 2 |
| references/analyze.md | Task 3 |
| references/report.md | Task 4 |
| scripts/create_dir.sh | Task 5 |
| scripts/serve_preview.sh | Task 6 |
| scripts/tradingview.js | Task 7 |
| scripts/report.tsx | Task 8 |
| bun 预览服务器 | Task 6 |
| TSX 报告生成 | Task 8 |

所有 spec 要求已覆盖。
---
name: stock-kline-analysis
description: 分析美股 K 线图走势并生成详细报告。使用 TradingView 网站获取实时数据，通过截图分析技术指标、趋势方向、关键价位和买卖信号。当用户询问股票分析、技术分析、K线解读、趋势判断、买卖建议时触发此技能。
---

# Stock K-Line Analysis Skill

使用 TradingView 对美股进行技术分析，生成详细的分析报告。

## ⚠️ 工作目录规范

**工作目录**：项目根目录

**技能目录**：`skills/stock-kline-analysis/`

所有路径使用相对于项目根目录的路径：

| 操作 | 相对路径 |
|------|----------|
| 创建数据目录 | `skills/stock-kline-analysis/scripts/create_dir.sh` |
| 数据存储位置 | `skills/stock-kline-analysis/data/analysis/{datetime}-{symbol}-{interval}/` |
| 截图保存 | `skills/stock-kline-analysis/data/analysis/.../screenshot.jpg` |
| 报告保存 | `skills/stock-kline-analysis/data/analysis/.../report.md` |
| 安装依赖 | `cd skills/stock-kline-analysis/scripts && bun install` |
| 启动预览 | `cd skills/stock-kline-analysis && ./scripts/serve_preview.sh data/analysis/...` |

## 数据存储

所有分析数据存储在技能目录下：

```
skills/stock-kline-analysis/data/analysis/{YYYY-MM-DD-HH-MM-SS}-{symbol}-{interval}/
├── screenshot.jpg       # K 线图截图
├── analysis_output.json # 分析数据（中间产物）
└── report.md            # Markdown 分析报告
```

**注意**：`data/` 目录已添加到 `.gitignore`，不应提交到版本控制。

## 工作流程（三阶段）

### 阶段 1：截图采集

**⚠️ 键盘优先原则**：TradingView 支持全局键盘输入，无需点击任何按钮。直接用键盘更高效。

**操作流程**：

1. 创建数据目录 → `scripts/create_dir.sh`
2. 打开 TradingView 图表并等待加载
3. **键盘操作（一次性执行）**：
   ```
   Shift+F          → 进入全屏（关闭 Strategy Report）
   输入股票代码      → 如 QQQ、NVDA、AAPL
   Enter            → 确认切换股票
   输入分钟数        → 240=4h, 60=1h, 1440=D
   Enter            → 确认切换周期
   ```
4. 等待图表加载后截图
5. **关闭页面** → 必须使用 `mcp__playwright__browser_tabs(action: "close")`

**⚠️ 重要**：截图完成后必须正确关闭 tab，使用 `browser_tabs(action: "close")`，不要使用 `browser_close`。

**周期分钟数**：`1`=1m, `5`=5m, `15`=15m, `30`=30m, `60`=1h, `120`=2h, `240`=4h, `1440`=D

详细步骤见 `references/capture.md`

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
2. 保存 `analysis_output.json` 分析数据（**必须严格遵循 ReportData 接口格式**）
3. 启动 bun server 动态渲染 HTML 预览

**⚠️ `analysis_output.json` 数据格式要求**：

必须严格遵循以下接口格式，否则渲染会失败：

```json
{
  "symbol": "AAPL",
  "price": 246.50,
  "change": "-0.92%",
  "interval": "4h",
  "datetime": "2026-03-31 03:08",
  "trend": "上涨|下跌|震荡",
  "action": "买入|卖出|观望",
  "riskLevel": "低|中|高",
  "support1": { "price": 245.96, "note": "说明" },
  "support2": { "price": 244.00, "note": "说明" },
  "resistance1": { "price": 247.45, "note": "说明" },
  "resistance2": { "price": 249.08, "note": "说明" },
  "bullishSignals": ["信号1", "信号2"],
  "bearishSignals": ["信号1", "信号2"],
  "entryCondition": "入场条件描述",
  "stopLoss": 244.00,
  "takeProfit": [249.08, 251.38],
  "risks": ["风险1", "风险2"],
  "summary": "一句话总结"
}
```

**注意**：
- `change` 必须以 `+` 或 `-` 开头（如 `+1.5%` 或 `-0.92%`）
- `trend`、`action`、`riskLevel` 必须使用指定枚举值
- `price`、`stopLoss`、`takeProfit` 必须是数字类型

## 预览报告

首次运行需安装依赖：

```bash
cd skills/stock-kline-analysis/scripts && bun install
```

使用 `scripts/serve_preview.sh` 启动动态渲染服务器：

```bash
./scripts/serve_preview.sh data/analysis/{datetime}-{symbol}-{interval}
# 打开 http://localhost:3000
```

**端口占用处理**：如端口 3000 被占用，先关闭占用进程：

```bash
lsof -ti:3000 | xargs kill -9
./scripts/serve_preview.sh data/analysis/{datetime}-{symbol}-{interval}
```

截图以 base64 嵌入页面，无需生成静态 HTML。

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
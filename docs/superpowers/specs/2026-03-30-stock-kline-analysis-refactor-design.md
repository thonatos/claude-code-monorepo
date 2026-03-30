# Stock K-Line Analysis Skill 重构设计

## 背景

当前 `stock-kline-analysis` 技能的 SKILL.md 约 450 行，内容过于集中：
- 工作流程步骤详解
- 技术分析方法论
- 报告模板（Markdown + HTML）
- 指标说明

需要拆分成模块化的 reference 文件，使 SKILL.md 保持简洁骨架，详细内容按职责分离。

## 目标

1. SKILL.md 保持 60-70 行的核心流程骨架
2. 拆分 references：capture.md、analyze.md、report.md
3. 提供辅助 scripts：create_dir.sh、serve_preview.sh、tradingview.js
4. 静态服务器改用 bun（检测已安装则使用，否则提示安装）

## 文件结构

```
stock-kline-analysis/
├── SKILL.md              # ~60-70 行
│   ├── YAML frontmatter（触发条件）
│   ├── 数据存储结构说明
│   ├── 三阶段流程骨架（摘要）
│   └── references/scripts 引用说明
│
├── references/
│   ├── capture.md        # 阶段 1：截图采集
│   │   ├── TradingView 打开与导航
│   │   ├── Strategy Report 检测与最小化
│   │   ├── 股票切换、周期调整
│   │   ├── 截图保存
│   │
│   ├── analyze.md        # 阶段 2：技术分析
│   │   ├── K 线形态分析方法
│   │   ├── 技术指标解读逻辑
│   │   ├── 关键价位识别
│   │   ├── 买卖信号综合判断
│   │
│   └── report.md         # 阶段 3：报告生成
│   │   ├── Markdown 模板（结论优先）
│   │   ├── HTML 模板
│   │   ├── 文件保存路径
│   │
└── scripts/
    ├── create_dir.sh     # 创建数据目录
    ├── serve_preview.sh  # bun 静态服务器检测与启动
    └── tradingview.js    # Playwright 操作封装函数
```

## SKILL.md 核心流程骨架

```markdown
---
name: stock-kline-analysis
description: 分析美股 K 线图走势并生成详细报告...
---

# Stock K-Line Analysis Skill

## 数据存储

所有分析数据存储在：
data/analysis/{YYYY-MM-DD}-{symbol}-{interval}/

## 工作流程（三阶段）

### 阶段 1：截图采集 → references/capture.md
1. 创建数据目录
2. 打开 TradingView 图表
3. 检查并最小化 Strategy Report
4. 切换目标股票代码
5. 调整时间周期
6. 截图保存

### 阶段 2：技术分析 → references/analyze.md
读取截图，进行 K 线形态分析、指标解读、关键价位识别、买卖信号判断。

### 阶段 3：报告生成 → references/report.md
生成 Markdown 和 HTML 报告（结论优先），提示预览路径。

## 预览报告

使用 scripts/serve_preview.sh 启动静态服务器。
```

## references/capture.md

包含详细操作步骤：
- 数据目录创建（脚本 + 手动两种方式）
- TradingView 打开与导航
- Strategy Report 检测与最小化逻辑
- 股票切换（使用 tradingview.js 封装或手动操作）
- 时间周期调整
- 截图保存（JPG 格式）

关键注意事项：
- TradingView 需保持登录状态
- 切换股票后等待图表完全加载
- 截图格式使用 JPG

## references/analyze.md

技术分析方法论文档：
- 价格走势识别（趋势判断、价格形态）
- K 线形态分析（单根/组合形态、关键参数）
- 技术指标解读（Trend Ribbon、VRVP、Bollinger、WaveTrend、MCDX）
- 关键价位识别（支撑/阻力来源）
- 买卖信号综合判断
- 风险评估

明确分析输出需要提取的关键信息用于报告生成。

## references/report.md

报告生成模板：
- 报告原则：结论优先
- Markdown 模板骨架
- HTML 模板完整代码
- 文件保存路径
- 预览服务说明

## scripts 设计

### create_dir.sh

```bash
#!/bin/bash
symbol=${1:-QQQ}
interval=${2:-4h}
date=$(date +%Y-%m-%d)
dir="data/analysis/${date}-${symbol}-${interval}"
mkdir -p "$dir"
echo "Created: $dir"
```

### serve_preview.sh

```bash
#!/bin/bash
PORT=3000
if ! command -v bun &> /dev/null; then
    echo "bun not found. Please install bun:"
    echo "  curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
bun x serve data/analysis -l $PORT
```

### tradingview.js

封装 Playwright 操作：
- `minimizeStrategyReport(page)` - 最小化 Strategy Report
- `switchSymbol(page, symbol)` - 切换股票代码
- `takeScreenshot(page, outputPath)` - 截图保存

通过 `browser_run_code` 调用。

## 实现步骤

1. 创建 references/ 目录
2. 创建 scripts/ 目录
3. 编写 capture.md
4. 编写 analyze.md
5. 编写 report.md（含 HTML 模板完整代码）
6. 编写 create_dir.sh
7. 编写 serve_preview.sh
8. 编写 tradingview.js
9. 重构 SKILL.md 为骨架版本
10. 删除原 SKILL.md 中冗余内容

## 验收标准

- SKILL.md 行数控制在 60-70 行
- 各 reference 文件职责清晰，可独立查阅
- scripts 可正常执行
- 预览服务能正常启动（bun 检测有效）
- 新结构与原功能保持一致
# 报告生成

## 报告原则

- **结论优先**：快速结论放在最前面，让用户第一时间获取关键信息

## Markdown 模板

```markdown
# 股票技术分析报告

## 快速结论

**趋势判断**：{{上涨/下跌/震荡}}
**操作建议**：{{买入/卖出/观望}}
**关键价位**：支撑 {{价格}} / 阻力 {{价格}}
**风险等级**：{{低/中/高}}

## 一句话总结

{{简洁的一句话总结}}

## 基本信息

- 股票代码：{{symbol}}
- 当前价格：{{price}}
- 涨跌幅：{{change}}
- 分析周期：{{interval}}
- 分析时间：{{datetime}}

## 详细分析

{{详细的技术分析内容}}

## 关键价位

| 类型 | 价格 | 说明 |
|------|------|------|
| 支撑位1 | {{price}} | {{note}} |
| 支撑位2 | {{price}} | {{note}} |
| 阻力位1 | {{price}} | {{note}} |
| 阻力位2 | {{price}} | {{note}} |

## 买卖信号

**看涨信号**：
- {{signal1}}
- {{signal2}}

**看跌信号**：
- {{signal1}}
- {{signal2}}

## 操作建议

| 项目 | 内容 |
|------|------|
| 入场条件 | {{condition}} |
| 止损位 | {{price}} |
| 目标位 | {{price1}}, {{price2}} |

## 风险提示

{{风险因素列表}}

## 免责声明

本报告仅供参考，不构成投资建议。
```

## TSX 报告生成器

使用 bun 的 TSX 支持生成 HTML 报告，参见 `scripts/report.tsx`。

### 数据接口

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

## 生成流程

1. 分析完成后保存 `analysis_output.json`
2. 运行 TSX 生成器命令：
   ```bash
   bun run scripts/report.tsx
   ```

## 文件保存路径

- `report.md` - Markdown 格式报告
- `report.html` - HTML 格式报告（交互式）
- `analysis_output.json` - 分析结果数据

## 预览服务

使用预览脚本查看生成的 HTML 报告：

```bash
bash scripts/serve_preview.sh
```

该脚本会启动本地 HTTP 服务，并在浏览器中打开报告预览。
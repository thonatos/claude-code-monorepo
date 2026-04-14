import { useLoaderData } from "react-router";
import type { Route } from "./+types/report";
import { Card, Badge, SignalItem } from "../components/trading";

// Types
interface ReportData {
  symbol: string;
  price: number;
  change: string;
  interval: string;
  datetime: string;
  trend: "上涨" | "下跌" | "震荡";
  action: "买入" | "卖出" | "观望";
  riskLevel: "低" | "中" | "高";
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

// Mock Data Generator
function generateReportData(symbol: string, interval: string, datetime: string): ReportData {
  const hash = symbol.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  const basePrice = 100 + (hash % 900);
  const changePercent = ((hash % 100) - 50) / 10;
  const isUp = changePercent > 0;

  const trend: ReportData["trend"] = changePercent > 2 ? "上涨" : changePercent < -2 ? "下跌" : "震荡";
  const action: ReportData["action"] = isUp ? "买入" : "观望";
  const riskLevel: ReportData["riskLevel"] = Math.abs(changePercent) > 5 ? "高" : Math.abs(changePercent) > 2 ? "中" : "低";

  return {
    symbol,
    price: basePrice,
    change: `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}%`,
    interval,
    datetime,
    trend,
    action,
    riskLevel,
    support1: { price: basePrice * 0.95, note: "20 日均线" },
    support2: { price: basePrice * 0.90, note: "60 日均线" },
    resistance1: { price: basePrice * 1.05, note: "前期高点" },
    resistance2: { price: basePrice * 1.10, note: "历史阻力位" },
    bullishSignals: ["MACD 金叉", "成交量放大"],
    bearishSignals: ["RSI 超买区域"],
    entryCondition: "突破阻力位后回踩确认",
    stopLoss: basePrice * 0.95,
    takeProfit: [basePrice * 1.05, basePrice * 1.10],
    risks: ["宏观经济不确定性", "行业政策变化"],
    summary: `${symbol} 在${interval} 周期下呈现${trend}趋势，建议${action}。关键支撑位$${(basePrice * 0.95).toFixed(2)}，阻力位$${(basePrice * 1.05).toFixed(2)}。`,
  };
}

// Loader
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") || "AAPL";
  const interval = url.searchParams.get("interval") || "1D";
  const datetime = url.searchParams.get("datetime") || new Date().toISOString();

  const data = generateReportData(symbol, interval, datetime);

  return { symbol, interval, datetime, data };
}

// Components
function Header({ data }: { data: ReportData }) {
  const changeStr = data.change;
  const priceClass = changeStr.startsWith("+")
    ? "text-[var(--accent-green)]"
    : changeStr.startsWith("-")
    ? "text-[var(--accent-red)]"
    : "text-[var(--accent-amber)]";
  const bgClass = changeStr.startsWith("+")
    ? "bg-[var(--accent-green-dim)]"
    : changeStr.startsWith("-")
    ? "bg-[var(--accent-red-dim)]"
    : "bg-[var(--accent-amber-dim)]";

  return (
    <header className="flex items-start justify-between p-8 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl mb-6">
      <div className="flex items-center gap-6">
        <div className="w-18 h-18 flex items-center justify-center bg-gradient-to-br from-[var(--accent-blue)] to-purple-500 rounded-2xl font-mono text-2xl font-bold text-white shadow-lg shadow-blue-500/30">
          {data.symbol}
        </div>
        <div>
          <h1 className="text-3xl font-extrabold mb-1">{data.symbol} 技术分析报告</h1>
          <div className="flex items-center gap-4 text-sm font-mono text-[var(--text-secondary)]">
            <span>⏱ {data.interval}</span>
            <span>📅 {data.datetime}</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-5xl font-bold leading-none mb-2">${data.price.toFixed(2)}</div>
        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-semibold ${bgClass} ${priceClass}`}>
          {changeStr.startsWith("+") ? "▲" : changeStr.startsWith("-") ? "▼" : "●"} {changeStr}
        </span>
      </div>
    </header>
  );
}

function ConclusionCard({ data }: { data: ReportData }) {
  const actionVariant = data.action === "买入" ? "buy" : data.action === "卖出" ? "sell" : "wait";
  const trendClass =
    data.trend === "上涨"
      ? "text-[var(--accent-green)]"
      : data.trend === "下跌"
      ? "text-[var(--accent-red)]"
      : "text-[var(--accent-amber)]";
  const riskVariant = data.riskLevel === "低" ? "buy" : data.riskLevel === "中" ? "wait" : "sell";

  return (
    <div className="bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl overflow-hidden mb-6">
      <div className="p-6 border-b border-[var(--border)]">
        <Badge variant={actionVariant as any} size="lg">
          {data.action === "买入" ? "↗" : data.action === "卖出" ? "↘" : "→"} {data.action}
        </Badge>
      </div>
      <div className="grid gap-4 p-6">
        <div className="flex justify-between items-center p-4 bg-[var(--bg-primary)] rounded-xl">
          <span className="text-sm text-[var(--text-muted)] font-medium">趋势判断</span>
          <span className={`font-mono font-semibold ${trendClass}`}>{data.trend}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-[var(--bg-primary)] rounded-xl">
          <span className="text-sm text-[var(--text-muted)] font-medium">风险等级</span>
          <Badge variant={riskVariant as any} size="sm">{data.riskLevel}</Badge>
        </div>
        <div className="flex justify-between items-center p-4 bg-[var(--bg-primary)] rounded-xl">
          <span className="text-sm text-[var(--text-muted)] font-medium">关键支撑</span>
          <span className="font-mono font-semibold">${data.support1.price.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-[var(--bg-primary)] rounded-xl">
          <span className="text-sm text-[var(--text-muted)] font-medium">关键阻力</span>
          <span className="font-mono font-semibold">${data.resistance1.price.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ data }: { data: ReportData }) {
  return (
    <Card title="📊 分析摘要">
      <p className="text-[var(--text-secondary)] leading-relaxed">{data.summary}</p>
    </Card>
  );
}

function KeyLevelsCard({ data }: { data: ReportData }) {
  const levels = [
    { type: "resistance", label: "阻力 2", price: data.resistance2.price, note: data.resistance2.note },
    { type: "resistance", label: "阻力 1", price: data.resistance1.price, note: data.resistance1.note },
    { type: "support", label: "支撑 1", price: data.support1.price, note: data.support1.note },
    { type: "support", label: "支撑 2", price: data.support2.price, note: data.support2.note },
  ];

  return (
    <Card title="🎯 关键价位">
      <div className="grid gap-3">
        {levels.map((level, i) => (
          <div
            key={i}
            className={`flex justify-between items-center p-4 bg-[var(--bg-primary)] rounded-xl border-l-[3px] ${
              level.type === "support"
                ? "border-l-[var(--accent-green)]"
                : "border-l-[var(--accent-red)]"
            }`}
          >
            <div>
              <div className="text-xs text-[var(--text-muted)] uppercase mb-1">{level.label}</div>
              <div className="font-mono font-semibold">${level.price.toFixed(2)}</div>
            </div>
            <span className="text-xs text-[var(--text-muted)]">{level.note}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SignalsCard({ data }: { data: ReportData }) {
  return (
    <Card title="📡 买卖信号">
      <div className="flex flex-col gap-2.5">
        {data.bullishSignals.map((signal, i) => (
          <SignalItem key={`bull-${i}`} type="bullish">{signal}</SignalItem>
        ))}
        {data.bearishSignals.map((signal, i) => (
          <SignalItem key={`bear-${i}`} type="bearish">{signal}</SignalItem>
        ))}
      </div>
    </Card>
  );
}

function RecommendationsCard({ data }: { data: ReportData }) {
  return (
    <Card title="💡 操作建议">
      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between items-start p-4 bg-[var(--bg-primary)] rounded-xl">
          <div>
            <div className="text-xs text-[var(--text-muted)] uppercase mb-1">入场时机</div>
            <div className="text-[var(--text-secondary)]">{data.entryCondition}</div>
          </div>
        </div>
        <div className="flex justify-between items-start p-4 bg-[var(--bg-primary)] rounded-xl">
          <div>
            <div className="text-xs text-[var(--text-muted)] uppercase mb-1">止损位置</div>
            <div className="font-mono font-semibold text-[var(--accent-blue)]">${data.stopLoss.toFixed(2)}</div>
          </div>
        </div>
        <div className="flex justify-between items-start p-4 bg-[var(--bg-primary)] rounded-xl">
          <div>
            <div className="text-xs text-[var(--text-muted)] uppercase mb-1">止盈目标</div>
            <div className="font-mono font-semibold text-[var(--accent-blue)]">
              {data.takeProfit.map((p) => `$${p.toFixed(2)}`).join(" → ")}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RisksCard({ data }: { data: ReportData }) {
  return (
    <Card title="⚠️ 风险提示">
      <div className="flex flex-col gap-2">
        {data.risks.map((risk, i) => (
          <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 bg-[var(--accent-amber-dim)] rounded-lg text-[var(--accent-amber)] text-sm">
            <span>⚠</span>
            <span>{risk}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ChartPlaceholder() {
  return (
    <div className="w-full h-96 bg-[var(--bg-elevated)] rounded-2xl flex items-center justify-center text-[var(--text-muted)]">
      <span className="text-lg">📈 K 线图表区域 (可接入真实图表库)</span>
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="mt-6 p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)] text-center">
      <strong className="text-[var(--text-secondary)]">免责声明：</strong>
      本报告仅基于技术分析，不构成投资建议。投资有风险，决策需谨慎。
    </div>
  );
}

// Main Component
export default function Report() {
  const { data } = useLoaderData<typeof loader>();

  return (
    <div className="report-page min-h-screen bg-[var(--bg-primary)] p-8">
      <div className="report-container max-w-[2560px] mx-auto">
        <Header data={data} />

        {/* Three-column layout: left sidebar (320px), center (auto), right sidebar (400px) */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_400px] gap-6">
          {/* Left Sidebar */}
          <aside className="flex flex-col gap-6">
            <ConclusionCard data={data} />
            <SummaryCard data={data} />
            <KeyLevelsCard data={data} />
          </aside>

          {/* Center - Chart */}
          <main className="min-w-0">
            <ChartPlaceholder />
          </main>

          {/* Right Sidebar */}
          <aside className="flex flex-col gap-6">
            <SignalsCard data={data} />
            <RecommendationsCard data={data} />
            <RisksCard data={data} />
          </aside>
        </div>

        <Disclaimer />
      </div>
    </div>
  );
}

#!/usr/bin/env bun
/**
 * Stock K-Line Analysis Report Server
 * Modern trading terminal style report with 4K wide-screen optimization
 */

import { renderToString } from "react-dom/server";

// ============================================================================
// Interfaces
// ============================================================================

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

// ============================================================================
// CSS Styles - Modern Trading Terminal Theme
// ============================================================================

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700;800&display=swap');

  :root {
    --bg-primary: #0a0e17;
    --bg-secondary: #111827;
    --bg-card: #1a2234;
    --bg-elevated: #232d42;
    --border: #2d3a52;
    --text-primary: #f1f5f9;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --accent-green: #22c55e;
    --accent-green-dim: rgba(34, 197, 94, 0.15);
    --accent-red: #ef4444;
    --accent-red-dim: rgba(239, 68, 68, 0.15);
    --accent-amber: #f59e0b;
    --accent-amber-dim: rgba(245, 158, 11, 0.15);
    --accent-blue: #3b82f6;
    --accent-blue-dim: rgba(59, 130, 246, 0.15);
    --gradient-glow: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.6;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Background Effects */
  body::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:
      radial-gradient(ellipse 80% 50% at 20% -20%, rgba(59, 130, 246, 0.15), transparent),
      radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139, 92, 246, 0.1), transparent);
    pointer-events: none;
    z-index: 0;
  }

  /* Main Layout - 4K Optimized */
  .app {
    position: relative;
    z-index: 1;
    max-width: 2560px;
    margin: 0 auto;
    padding: 32px;
    animation: fadeIn 0.6s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Header */
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 24px 32px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    margin-bottom: 24px;
    animation: slideDown 0.5s ease-out;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .symbol-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background: linear-gradient(135deg, var(--accent-blue) 0%, #8b5cf6 100%);
    border-radius: 16px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.5px;
    box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3);
  }

  .header-info h1 {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.5px;
    margin-bottom: 4px;
  }

  .header-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    color: var(--text-secondary);
    font-size: 14px;
    font-family: 'JetBrains Mono', monospace;
  }

  .header-meta span {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header-right {
    text-align: right;
  }

  .price-display {
    font-family: 'JetBrains Mono', monospace;
    font-size: 48px;
    font-weight: 700;
    letter-spacing: -1px;
    line-height: 1;
    margin-bottom: 8px;
  }

  .price-change {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px;
    font-weight: 600;
  }

  .price-up {
    color: var(--accent-green);
    background: var(--accent-green-dim);
  }
  .price-down {
    color: var(--accent-red);
    background: var(--accent-red-dim);
  }
  .price-neutral {
    color: var(--accent-amber);
    background: var(--accent-amber-dim);
  }

  /* Main Grid Layout */
  .main-grid {
    display: grid;
    grid-template-columns: 320px 1fr 400px;
    gap: 24px;
    animation: fadeIn 0.6s ease-out 0.2s both;
  }

  /* Card Base */
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elevated);
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
  }

  .card-body {
    padding: 24px;
  }

  /* Left Sidebar */
  .sidebar-left {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Conclusion Card */
  .conclusion-card {
    background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    position: relative;
  }

  .conclusion-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent-blue), #8b5cf6);
  }

  .conclusion-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border);
  }

  .action-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 12px;
    font-size: 18px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-buy {
    background: var(--accent-green-dim);
    color: var(--accent-green);
    box-shadow: 0 0 24px rgba(34, 197, 94, 0.2);
  }
  .action-sell {
    background: var(--accent-red-dim);
    color: var(--accent-red);
    box-shadow: 0 0 24px rgba(239, 68, 68, 0.2);
  }
  .action-wait {
    background: var(--accent-amber-dim);
    color: var(--accent-amber);
    box-shadow: 0 0 24px rgba(245, 158, 11, 0.2);
  }

  .conclusion-grid {
    display: grid;
    gap: 16px;
    padding: 20px 24px;
  }

  .conclusion-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-primary);
    border-radius: 10px;
  }

  .conclusion-label {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .conclusion-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px;
    font-weight: 600;
  }

  .trend-up { color: var(--accent-green); }
  .trend-down { color: var(--accent-red); }
  .trend-neutral { color: var(--accent-amber); }

  .risk-badge {
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
  }
  .risk-low { background: var(--accent-green-dim); color: var(--accent-green); }
  .risk-medium { background: var(--accent-amber-dim); color: var(--accent-amber); }
  .risk-high { background: var(--accent-red-dim); color: var(--accent-red); }

  /* Summary Card */
  .summary-card .card-body {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.7;
  }

  /* Key Levels Card */
  .levels-grid {
    display: grid;
    gap: 12px;
  }

  .level-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    background: var(--bg-primary);
    border-radius: 10px;
    border-left: 3px solid transparent;
  }

  .level-support {
    border-left-color: var(--accent-green);
  }

  .level-resistance {
    border-left-color: var(--accent-red);
  }

  .level-type {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .level-price {
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px;
    font-weight: 600;
  }

  .level-note {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* Center - Chart */
  .chart-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .chart-container {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: var(--bg-card);
    border: 1px solid var(--border);
  }

  .chart-image {
    width: 100%;
    height: auto;
    display: block;
  }

  .chart-overlay {
    position: absolute;
    top: 16px;
    left: 16px;
    display: flex;
    gap: 8px;
  }

  .chart-badge {
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary);
  }

  /* Right Sidebar */
  .sidebar-right {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Signals */
  .signals-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .signal-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    background: var(--bg-primary);
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.5;
  }

  .signal-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
  }

  .signal-bullish {
    background: var(--accent-green-dim);
    color: var(--accent-green);
  }

  .signal-bearish {
    background: var(--accent-red-dim);
    color: var(--accent-red);
  }

  /* Recommendations */
  .recommendation-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px;
    background: var(--bg-primary);
    border-radius: 10px;
    margin-bottom: 10px;
  }

  .recommendation-item:last-child {
    margin-bottom: 0;
  }

  .recommendation-label {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .recommendation-value {
    font-size: 14px;
    color: var(--text-primary);
  }

  .recommendation-price {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--accent-blue);
  }

  /* Risks */
  .risks-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .risk-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--accent-amber-dim);
    border-radius: 8px;
    font-size: 13px;
    color: var(--accent-amber);
  }

  .risk-item::before {
    content: '⚠';
    font-size: 14px;
  }

  /* Disclaimer */
  .disclaimer {
    margin-top: 24px;
    padding: 20px 24px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.6;
    text-align: center;
    animation: fadeIn 0.6s ease-out 0.4s both;
  }

  .disclaimer strong {
    color: var(--text-secondary);
  }

  /* Responsive */
  @media (max-width: 1600px) {
    .main-grid {
      grid-template-columns: 280px 1fr 340px;
    }
  }

  @media (max-width: 1200px) {
    .main-grid {
      grid-template-columns: 1fr;
    }
    .sidebar-left, .sidebar-right {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }
  }

  @media (max-width: 768px) {
    .app { padding: 16px; }
    .header {
      flex-direction: column;
      gap: 20px;
      text-align: center;
    }
    .header-left { flex-direction: column; }
    .header-right { text-align: center; }
    .price-display { font-size: 36px; }
    .header-info h1 { font-size: 24px; }
  }
`;

// ============================================================================
// Components
// ============================================================================

function Container({ children }: { children: any }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>股票技术分析报告</title>
        <style dangerouslySetInnerHTML={{ __html: styles }} />
      </head>
      <body>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}

function Header({ data }: { data: ReportData }) {
  const priceClass = data.change.startsWith('+') ? 'price-up' :
                     data.change.startsWith('-') ? 'price-down' : 'price-neutral';

  return (
    <header className="header">
      <div className="header-left">
        <div className="symbol-badge">{data.symbol}</div>
        <div className="header-info">
          <h1>{data.symbol} 技术分析报告</h1>
          <div className="header-meta">
            <span>⏱ {data.interval}</span>
            <span>📅 {data.datetime}</span>
          </div>
        </div>
      </div>
      <div className="header-right">
        <div className="price-display">${data.price.toFixed(2)}</div>
        <span className={`price-change ${priceClass}`}>
          {data.change.startsWith('+') ? '▲' : data.change.startsWith('-') ? '▼' : '●'} {data.change}
        </span>
      </div>
    </header>
  );
}

function ConclusionCard({ data }: { data: ReportData }) {
  const actionClass = data.action === '买入' ? 'action-buy' :
                      data.action === '卖出' ? 'action-sell' : 'action-wait';

  const trendClass = data.trend === '上涨' ? 'trend-up' :
                     data.trend === '下跌' ? 'trend-down' : 'trend-neutral';

  const riskClass = data.riskLevel === '低' ? 'risk-low' :
                    data.riskLevel === '中' ? 'risk-medium' : 'risk-high';

  return (
    <div className="conclusion-card">
      <div className="conclusion-header">
        <span className={`action-badge ${actionClass}`}>
          {data.action === '买入' ? '↗' : data.action === '卖出' ? '↘' : '→'} {data.action}
        </span>
      </div>
      <div className="conclusion-grid">
        <div className="conclusion-item">
          <span className="conclusion-label">趋势判断</span>
          <span className={`conclusion-value ${trendClass}`}>{data.trend}</span>
        </div>
        <div className="conclusion-item">
          <span className="conclusion-label">风险等级</span>
          <span className={`risk-badge ${riskClass}`}>{data.riskLevel}</span>
        </div>
        <div className="conclusion-item">
          <span className="conclusion-label">关键支撑</span>
          <span className="conclusion-value">${data.support1.price.toFixed(2)}</span>
        </div>
        <div className="conclusion-item">
          <span className="conclusion-label">关键阻力</span>
          <span className="conclusion-value">${data.resistance1.price.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ data }: { data: ReportData }) {
  return (
    <div className="card summary-card">
      <div className="card-header">
        <span className="card-title">📊 分析摘要</span>
      </div>
      <div className="card-body">{data.summary}</div>
    </div>
  );
}

function KeyLevelsCard({ data }: { data: ReportData }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">🎯 关键价位</span>
      </div>
      <div className="card-body">
        <div className="levels-grid">
          <div className="level-item level-resistance">
            <div>
              <div className="level-type">阻力 2</div>
              <div className="level-price">${data.resistance2.price.toFixed(2)}</div>
            </div>
            <span className="level-note">{data.resistance2.note}</span>
          </div>
          <div className="level-item level-resistance">
            <div>
              <div className="level-type">阻力 1</div>
              <div className="level-price">${data.resistance1.price.toFixed(2)}</div>
            </div>
            <span className="level-note">{data.resistance1.note}</span>
          </div>
          <div className="level-item level-support">
            <div>
              <div className="level-type">支撑 1</div>
              <div className="level-price">${data.support1.price.toFixed(2)}</div>
            </div>
            <span className="level-note">{data.support1.note}</span>
          </div>
          <div className="level-item level-support">
            <div>
              <div className="level-type">支撑 2</div>
              <div className="level-price">${data.support2.price.toFixed(2)}</div>
            </div>
            <span className="level-note">{data.support2.note}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartSection() {
  return (
    <div className="chart-section">
      <div className="chart-container">
        <img src="/screenshot.jpg" alt="K线图" className="chart-image" />
        <div className="chart-overlay">
          <span className="chart-badge">K-Line</span>
        </div>
      </div>
    </div>
  );
}

function SignalsCard({ data }: { data: ReportData }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">📡 买卖信号</span>
      </div>
      <div className="card-body">
        <div className="signals-list">
          {data.bullishSignals.map((signal, i) => (
            <div key={`bull-${i}`} className="signal-item">
              <span className="signal-icon signal-bullish">✓</span>
              <span>{signal}</span>
            </div>
          ))}
          {data.bearishSignals.map((signal, i) => (
            <div key={`bear-${i}`} className="signal-item">
              <span className="signal-icon signal-bearish">✗</span>
              <span>{signal}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecommendationsCard({ data }: { data: ReportData }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">💡 操作建议</span>
      </div>
      <div className="card-body">
        <div className="recommendation-item">
          <div>
            <div className="recommendation-label">入场时机</div>
            <div className="recommendation-value">{data.entryCondition}</div>
          </div>
        </div>
        <div className="recommendation-item">
          <div>
            <div className="recommendation-label">止损位置</div>
            <div className="recommendation-price">${data.stopLoss.toFixed(2)}</div>
          </div>
        </div>
        <div className="recommendation-item">
          <div>
            <div className="recommendation-label">止盈目标</div>
            <div className="recommendation-price">
              {data.takeProfit.map(p => `$${p.toFixed(2)}`).join(' → ')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RisksCard({ data }: { data: ReportData }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">⚠️ 风险提示</span>
      </div>
      <div className="card-body">
        <div className="risks-list">
          {data.risks.map((risk, i) => (
            <div key={i} className="risk-item">{risk}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="disclaimer">
      <strong>免责声明：</strong>本报告仅基于技术分析，不构成投资建议。投资有风险，决策需谨慎。
      历史表现不代表未来收益，请在做出投资决策前进行充分的研究和风险评估。
    </div>
  );
}

function Report({ data }: { data: ReportData }) {
  return (
    <Container>
      <Header data={data} />

      <div className="main-grid">
        {/* Left Sidebar */}
        <aside className="sidebar-left">
          <ConclusionCard data={data} />
          <SummaryCard data={data} />
          <KeyLevelsCard data={data} />
        </aside>

        {/* Center - Chart */}
        <main className="chart-section">
          <ChartSection />
        </main>

        {/* Right Sidebar */}
        <aside className="sidebar-right">
          <SignalsCard data={data} />
          <RecommendationsCard data={data} />
          <RisksCard data={data} />
        </aside>
      </div>

      <Disclaimer />
    </Container>
  );
}

// ============================================================================
// Server
// ============================================================================

interface AnalysisDir {
  path: string;
  data: ReportData;
  screenshotPath: string;
}

async function loadAnalysisDir(dirPath: string): Promise<AnalysisDir | null> {
  const dataPath = `${dirPath}/analysis_output.json`;
  const screenshotPath = `${dirPath}/screenshot.jpg`;

  const dataFile = Bun.file(dataPath);
  const screenshotFile = Bun.file(screenshotPath);

  if (!(await dataFile.exists()) || !(await screenshotFile.exists())) {
    return null;
  }

  const data = await dataFile.json<ReportData>();

  return { path: dirPath, data, screenshotPath };
}

const args = Bun.argv.slice(2);
const analysisDir = args[0] || './data/analysis';

console.log(`Loading analysis from: ${analysisDir}`);

const analysis = await loadAnalysisDir(analysisDir);

if (!analysis) {
  console.error(`Error: Could not find analysis files in ${analysisDir}`);
  console.error('Required files: analysis_output.json, screenshot.jpg');
  process.exit(1);
}

console.log(`Starting server for: ${analysis.data.symbol} ${analysis.data.interval}`);
console.log(`Open http://localhost:3000 to view the report`);

Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = renderToString(<Report data={analysis.data} />);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    if (url.pathname === '/screenshot.jpg') {
      return new Response(Bun.file(analysis.screenshotPath), {
        headers: { 'Content-Type': 'image/jpeg' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
});
#!/usr/bin/env bun
/**
 * Stock K-Line Analysis Report Server
 * Dynamically renders TSX + data using bun's built-in server
 * Serves screenshot as static file (not base64) to save context space
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
// CSS Styles
// ============================================================================

const styles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
  }
  .container {
    background: white;
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }
  h1 {
    color: #1a1a1a;
    border-bottom: 3px solid #667eea;
    padding-bottom: 15px;
    margin-bottom: 25px;
    font-size: 2em;
    font-weight: 700;
  }
  h2 {
    color: #1a1a1a;
    margin: 30px 0 20px;
    font-size: 1.5em;
    font-weight: 600;
  }
  h3 {
    color: #555;
    margin: 20px 0 15px;
    font-size: 1.2em;
    font-weight: 600;
  }
  .screenshot {
    width: 100%;
    max-width: 900px;
    border-radius: 8px;
    margin: 20px 0 30px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .conclusion {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 25px;
    border-radius: 8px;
    margin-bottom: 30px;
    color: white;
  }
  .conclusion h2 {
    color: white;
    margin-top: 0;
    border-bottom: 2px solid rgba(255,255,255,0.3);
    padding-bottom: 10px;
  }
  .conclusion-box {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    margin-top: 15px;
  }
  .conclusion-item {
    padding: 15px;
    background: rgba(255,255,255,0.1);
    border-radius: 6px;
    backdrop-filter: blur(10px);
  }
  .conclusion-item strong {
    color: #fff;
    font-size: 0.95em;
    display: block;
    margin-bottom: 5px;
  }
  .summary {
    font-size: 1.1em;
    padding: 20px;
    background: rgba(255,255,255,0.15);
    border-radius: 6px;
    margin-top: 20px;
    font-weight: 500;
    line-height: 1.7;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    border-radius: 6px;
    overflow: hidden;
  }
  th, td {
    padding: 14px;
    text-align: left;
    border-bottom: 1px solid #e0e0e0;
  }
  th {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.85em;
    letter-spacing: 0.5px;
  }
  tr:hover {
    background: #f8f9fa;
  }
  .section {
    margin: 30px 0;
  }
  .bullish {
    color: #28a745;
    font-weight: 600;
  }
  .bearish {
    color: #dc3545;
    font-weight: 600;
  }
  ul {
    margin-left: 20px;
    margin-bottom: 20px;
  }
  li {
    margin: 10px 0;
    padding-left: 10px;
  }
  .disclaimer {
    font-size: 0.9em;
    color: #666;
    padding: 20px;
    background: #f8f9fa;
    border-left: 4px solid #667eea;
    border-radius: 4px;
    margin-top: 40px;
    font-style: italic;
  }
  .price-up { color: #28a745; font-weight: 600; }
  .price-down { color: #dc3545; font-weight: 600; }
  .price-neutral { color: #ffc107; font-weight: 600; }
  .signal-list {
    list-style: none;
    padding: 0;
  }
  .signal-list li {
    padding: 12px;
    margin: 8px 0;
    background: #f8f9fa;
    border-radius: 4px;
    border-left: 3px solid #667eea;
  }
  .risk-badge {
    display: inline-block;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 0.9em;
    font-weight: 600;
  }
  .risk-low { background: #d4edda; color: #155724; }
  .risk-medium { background: #fff3cd; color: #856404; }
  .risk-high { background: #f8d7da; color: #721c24; }
  .action-badge {
    display: inline-block;
    padding: 8px 20px;
    border-radius: 20px;
    font-size: 1em;
    font-weight: 600;
    text-transform: uppercase;
  }
  .action-buy { background: #d4edda; color: #155724; }
  .action-sell { background: #f8d7da; color: #721c24; }
  .action-wait { background: #e2e3e5; color: #383d41; }
  @media (max-width: 768px) {
    .conclusion-box {
      grid-template-columns: 1fr;
    }
    body {
      padding: 10px;
    }
    .container {
      padding: 20px;
    }
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
        <style>{styles}</style>
      </head>
      <body>
        <div className="container">
          {children}
        </div>
      </body>
    </html>
  );
}

function Conclusion({ data }: { data: ReportData }) {
  const actionClass = data.action === '买入' ? 'action-buy' :
                      data.action === '卖出' ? 'action-sell' : 'action-wait';

  const riskClass = data.riskLevel === '低' ? 'risk-low' :
                    data.riskLevel === '中' ? 'risk-medium' : 'risk-high';

  return (
    <div className="conclusion">
      <h2>快速结论</h2>
      <div className="conclusion-box">
        <div className="conclusion-item">
          <strong>趋势判断：</strong>
          {data.trend}
        </div>
        <div className="conclusion-item">
          <strong>操作建议：</strong>
          <span className={actionClass}>{data.action}</span>
        </div>
        <div className="conclusion-item">
          <strong>风险等级：</strong>
          <span className={riskClass}>{data.riskLevel}</span>
        </div>
        <div className="conclusion-item">
          <strong>关键支撑：</strong>
          ${data.support1.price.toFixed(2)}
        </div>
        <div className="conclusion-item">
          <strong>关键阻力：</strong>
          ${data.resistance1.price.toFixed(2)}
        </div>
        <div className="conclusion-item">
          <strong>分析周期：</strong>
          {data.interval}
        </div>
      </div>
      <div className="summary">
        {data.summary}
      </div>
    </div>
  );
}

function Screenshot() {
  return (
    <img
      src="/screenshot.jpg"
      alt="K线图截图"
      className="screenshot"
    />
  );
}

function BasicInfo({ data }: { data: ReportData }) {
  const priceClass = data.change.startsWith('+') ? 'price-up' :
                     data.change.startsWith('-') ? 'price-down' : 'price-neutral';

  return (
    <div className="section">
      <h2>基本信息</h2>
      <table>
        <tbody>
          <tr>
            <th>股票代码</th>
            <td>{data.symbol}</td>
          </tr>
          <tr>
            <th>当前价格</th>
            <td>${data.price.toFixed(2)}</td>
          </tr>
          <tr>
            <th>涨跌幅</th>
            <td className={priceClass}>{data.change}</td>
          </tr>
          <tr>
            <th>分析周期</th>
            <td>{data.interval}</td>
          </tr>
          <tr>
            <th>分析时间</th>
            <td>{data.datetime}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function KeyLevels({ data }: { data: ReportData }) {
  return (
    <div className="section">
      <h2>关键价位</h2>
      <table>
        <thead>
          <tr>
            <th>类型</th>
            <th>价位</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>支撑 1</td>
            <td>${data.support1.price.toFixed(2)}</td>
            <td>{data.support1.note}</td>
          </tr>
          <tr>
            <td>支撑 2</td>
            <td>${data.support2.price.toFixed(2)}</td>
            <td>{data.support2.note}</td>
          </tr>
          <tr>
            <td>阻力 1</td>
            <td>${data.resistance1.price.toFixed(2)}</td>
            <td>{data.resistance1.note}</td>
          </tr>
          <tr>
            <td>阻力 2</td>
            <td>${data.resistance2.price.toFixed(2)}</td>
            <td>{data.resistance2.note}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Signals({ data }: { data: ReportData }) {
  return (
    <div className="section">
      <h2>买卖信号</h2>
      {data.bullishSignals.length > 0 && (
        <>
          <h3 className="bullish">多头信号 ✅</h3>
          <ul className="signal-list">
            {data.bullishSignals.map((signal, index) => (
              <li key={index}>{signal}</li>
            ))}
          </ul>
        </>
      )}
      {data.bearishSignals.length > 0 && (
        <>
          <h3 className="bearish">空头信号 ❌</h3>
          <ul className="signal-list">
            {data.bearishSignals.map((signal, index) => (
              <li key={index}>{signal}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Recommendations({ data }: { data: ReportData }) {
  return (
    <div className="section">
      <h2>操作建议</h2>
      <table>
        <thead>
          <tr>
            <th>项目</th>
            <th>建议</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>入场时机</td>
            <td>{data.entryCondition}</td>
          </tr>
          <tr>
            <td>止损位置</td>
            <td>${data.stopLoss.toFixed(2)}</td>
          </tr>
          <tr>
            <td>止盈目标</td>
            <td>{data.takeProfit.map(p => `$${p.toFixed(2)}`).join(', ')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Risks({ data }: { data: ReportData }) {
  return (
    <div className="section">
      <h2>风险提示</h2>
      <ul className="signal-list">
        {data.risks.map((risk, index) => (
          <li key={index}>{risk}</li>
        ))}
      </ul>
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="disclaimer">
      <strong>免责声明：</strong>本报告仅基于技术分析，不构成投资建议。投资有风险，决策需谨慎。历史表现不代表未来收益，请在做出投资决策前进行充分的研究和风险评估。
    </div>
  );
}

function Report({ data }: { data: ReportData }) {
  return (
    <Container>
      <h1>{data.symbol} K 线技术分析报告</h1>

      <Conclusion data={data} />

      <Screenshot />

      <BasicInfo data={data} />

      <KeyLevels data={data} />

      <Signals data={data} />

      <Recommendations data={data} />

      <Risks data={data} />

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

  // Check files exist
  const dataFile = Bun.file(dataPath);
  const screenshotFile = Bun.file(screenshotPath);

  if (!(await dataFile.exists()) || !(await screenshotFile.exists())) {
    return null;
  }

  const data = await dataFile.json<ReportData>();

  return {
    path: dirPath,
    data,
    screenshotPath
  };
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
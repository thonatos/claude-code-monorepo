# Skills Reference

Installed skills and their usage in this monorepo.

## Installed Skills

| Skill | Source | Purpose |
|-------|--------|---------|
| fireworks-tech-graph | yizhiyanhua-ai/fireworks-tech-graph | Technical diagram generation (SVG/PNG) |
| frontend-design | anthropics/skills | Production-grade frontend interfaces |
| stock-kline-analysis | local | US stock K-line chart analysis |
| vercel-react-best-practices | anthropics/skills | React/Next.js performance patterns |
| web-design-guidelines | anthropics/skills | Web Interface Guidelines compliance |

## Skill Locations

Skills are installed in two locations:

```
.agents/skills/          # Skill implementations
├── fireworks-tech-graph/
├── frontend-design/
├── stock-kline-analysis/
├── vercel-react-best-practices/
└── web-design-guidelines/

.claude/skills/          # Symlinks to implementations
├── fireworks-tech-graph → ../../.agents/skills/fireworks-tech-graph
├── frontend-design → ../../.agents/skills/frontend-design
├── stock-kline-analysis → ../../skills/stock-kline-analysis
├── vercel-react-best-practices → ../../.agents/skills/vercel-react-best-practices
└── web-design-guidelines → ../../.agents/skills/web-design-guidelines
```

## Skill Usage

Skills are invoked via the Skill tool when triggered by user requests or patterns.

### fireworks-tech-graph

Trigger: "画图", "架构图", "流程图", "generate diagram", etc.

Generates SVG technical diagrams with PNG export:
- Architecture diagrams
- Data flow diagrams
- Flowcharts
- Sequence diagrams
- Agent/memory diagrams
- UML diagrams

### frontend-design

Trigger: Building web components, pages, applications.

Creates production-grade frontend interfaces with high design quality.

### stock-kline-analysis

Trigger: Stock analysis requests, K-line chart analysis.

Analyzes US stock K-line charts using TradingView data.

### vercel-react-best-practices

Trigger: React/Next.js code optimization.

Provides performance optimization guidelines from Vercel Engineering.

### web-design-guidelines

Trigger: "review my UI", "check accessibility", "audit design".

Reviews UI code for Web Interface Guidelines compliance.
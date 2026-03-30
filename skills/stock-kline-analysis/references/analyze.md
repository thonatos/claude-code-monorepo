# Technical Analysis Methodology

## 1. Price Trend Identification

### Current Trend Judgment
- **Bullish**: Consistently higher highs and higher lows, price above moving averages
- **Bearish**: Consistently lower highs and lower lows, price below moving averages
- **Sideways**: Price oscillating within a range, moving averages flat

### Price Pattern Recognition
- **Head & Shoulders (Top/Bottom)**: Reversal patterns with three peaks/troughs, middle higher/lower
- **Double Top/Bottom**: Two peaks/troughs at similar levels, neckline breaks confirm
- **Triangle (Ascending/Descending/Symmetric)**: Converging trendlines, breakout signals direction
- **Rectangle/Box**: Horizontal support and resistance, breakout or bounce expected

## 2. K-Line Pattern Analysis

### Single Candlestick Interpretation
- **Doji (十字星)**: Small/none body, indecision, potential reversal
- **Hammer (锤子线)**: Long lower shadow, small body at top, bullish reversal at support
- **Hanging Man (上吊线)**: Hammer shape at resistance, bearish reversal signal
- **Bullish Engulfing (大阳线)**: Large bullish candle, strong buying pressure
- **Bearish Engulfing (大阴线)**: Large bearish candle, strong selling pressure
- **Engulfing Pattern**: Larger body engulfs previous candle, reversal signal

### Key Parameters
- **Body Size**: Real body length indicates buying/selling pressure strength
- **Upper Shadow Length**: Rejection of higher prices, resistance pressure
- **Lower Shadow Length**: Rejection of lower prices, support pressure

## 3. Technical Indicator Interpretation

### Trend Ribbon (趋势带)
- **Bulls Zone**: Price above ribbon, bullish momentum
- **Bears Zone**: Price below ribbon, bearish momentum
- **Judgment**: Ribbon direction and price position indicate trend strength

### VRVP (Volume Range Volume Profile)
- **Volume Concentration Areas**: High volume zones act as support/resistance
- **Volume-Price Alignment**: Rising price with high volume confirms trend
- **Divergence**: Price moves without volume support, potential reversal

### ATOM Bollinger (布林带)
- **Upper Band**: Resistance zone, potential overbought
- **Middle Band**: 20-period SMA, dynamic support/resistance
- **Lower Band**: Support zone, potential oversold
- **Bandwidth**: Wide bands indicate high volatility, narrow bands indicate consolidation

### WaveTrend (SYWT)
- **WT Value**: Oversold (<-40) or overbought (>40) conditions
- **WT_SMA**: Smoothing line, crossover signals
- **WT_DIF**: Difference between WT and SMA, momentum strength
- **Signals**: WT crossing above SMA = bullish, below SMA = bearish

### MCDX Fund Flow
- **Retailer (散户)**: Individual investor activity
- **Hot Money (游资)**: Short-term speculative capital
- **Banker (主力)**: Institutional/large capital flow
- **Interpretation**: Banker inflow + Hot Money follow = strong bullish signal

## 4. Key Price Level Identification

### Support Sources
- Previous reaction lows and swing points
- High volume zones in VRVP profile
- Bollinger Band lower band
- Moving averages (20/50/200)
- Trendline support

### Resistance Sources
- Previous reaction highs and swing points
- High volume zones in VRVP profile
- Bollinger Band upper band
- Moving averages (20/50/200)
- Trendline resistance

## 5. Buy/Sell Signal Comprehensive Judgment

### Bullish Signals Checklist
- Price breaks above resistance with volume
- Bullish candlestick patterns (Hammer, Engulfing, etc.)
- WT crosses above SMA from oversold zone
- Price enters Bulls Zone of Trend Ribbon
- Banker and Hot Money inflow in MCDX
- Bollinger Bands squeeze followed by upward breakout

### Bearish Signals Checklist
- Price breaks below support with volume
- Bearish candlestick patterns (Hanging Man, Engulfing, etc.)
- WT crosses below SMA from overbought zone
- Price enters Bears Zone of Trend Ribbon
- Banker and Hot Money outflow in MCDX
- Bollinger Bands squeeze followed by downward breakout

### Comprehensive Judgment Method
- Weight signals by reliability: Price patterns > Indicators > Fund flow
- Confirm with multiple indicators (at least 2-3 aligned)
- Consider market context (overall trend, volatility)
- Trade in direction of major trend, reversals require strong confirmation

## 6. Risk Assessment

### Technical Risks
- False breakouts and whipsaws
- Indicator divergence without price confirmation
- Overbought/oversold conditions may persist

### Market Risks
- High volatility periods widen stop-loss ranges
- Gap openings skip key levels
- Low liquidity periods cause slippage

### Operational Risks
- Emotional trading without confirmation
- Overleveraging positions
- Ignoring stop-loss levels

## Analysis Output Structure

```typescript
{
  symbol: string,
  price: number,
  change: string,
  interval: string,
  datetime: string,
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
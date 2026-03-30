/**
 * TradingView Playwright 操作封装
 * 使用键盘快捷键操作，节省 token 且更可靠
 */

/**
 * 进入全屏模式（同时关闭 Strategy Report）
 * 快捷键: Shift + F
 *
 * @param {import('playwright').Page} page - Playwright Page 对象
 * @returns {Promise<void>}
 */
async function enterFullscreen(page) {
  console.log('[tradingview] 进入全屏模式 (Shift+F)...');
  await page.keyboard.press('Shift+F');
  await page.waitForTimeout(1000);
}

/**
 * 退出全屏模式
 * 快捷键: Shift + F
 *
 * @param {import('playwright').Page} page - Playwright Page 对象
 * @returns {Promise<void>}
 */
async function exitFullscreen(page) {
  console.log('[tradingview] 退出全屏模式 (Shift+F)...');
  await page.keyboard.press('Shift+F');
  await page.waitForTimeout(500);
}

/**
 * 最小化 Strategy Report（使用全屏模式）
 *
 * @param {import('playwright').Page} page - Playwright Page 对象
 * @returns {Promise<void>}
 */
async function minimizeStrategyReport(page) {
  await enterFullscreen(page);
}

/**
 * 切换股票代码
 * 快捷键: 输入股票代码 + Enter
 *
 * @param {import('playwright').Page} page - Playwright Page 对象
 * @param {string} symbol - 目标股票代码（如 AAPL、TSLA、NVDA）
 * @returns {Promise<void>}
 */
async function switchSymbol(page, symbol) {
  console.log(`[tradingview] 切换股票: ${symbol}...`);
  await page.keyboard.type(symbol, { delay: 100 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
}

/**
 * 设置时间周期
 * 快捷键: 输入分钟数 + Enter
 *
 * 分钟数映射:
 * 60=1h, 240=4h, 1440=1D
 *
 * @param {import('playwright').Page} page - Playwright Page 对象
 * @param {string} interval - 时间周期（如 1h, 4h, 1D）
 * @returns {Promise<void>}
 */
async function setInterval(page, interval) {
  const intervalMap = {
    '1m': '1', '5m': '5', '15m': '15', '30m': '30',
    '1h': '60', '2h': '120', '4h': '240', '1D': '1440',
    'D': '1440', 'W': '10080'
  };

  const minutes = intervalMap[interval] || '240'; // 默认 4h
  console.log(`[tradingview] 切换周期: ${interval} (${minutes}分钟)...`);
  await page.keyboard.type(minutes, { delay: 100 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
}

/**
 * 截取图表截图
 *
 * @param {import('playwright').Page} page - Playwright Page 对象
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<boolean>}
 */
async function takeScreenshot(page, outputPath) {
  try {
    console.log(`[tradingview] 截图保存: ${outputPath}...`);
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: outputPath,
      type: 'jpeg',
      quality: 90,
      fullPage: false
    });
    console.log('[tradingview] 截图完成');
    return true;
  } catch (error) {
    console.error('[tradingview] 截图失败:', error.message);
    return false;
  }
}

/**
 * 完整采集流程
 *
 * @param {import('playwright').Page} page - Playwright Page 对象
 * @param {string} symbol - 股票代码
 * @param {string} interval - 时间周期
 * @param {string} outputPath - 截图输出路径
 */
async function capture(page, symbol, interval, outputPath) {
  console.log(`[tradingview] 开始采集: ${symbol} ${interval}`);

  // 1. 全屏模式
  await enterFullscreen(page);

  // 2. 切换股票
  await switchSymbol(page, symbol);

  // 3. 切换周期
  await setInterval(page, interval);

  // 4. 截图
  await takeScreenshot(page, outputPath);

  console.log(`[tradingview] 采集完成: ${outputPath}`);
}

// 导出函数
module.exports = {
  enterFullscreen,
  exitFullscreen,
  minimizeStrategyReport,
  switchSymbol,
  setInterval,
  takeScreenshot,
  capture
};
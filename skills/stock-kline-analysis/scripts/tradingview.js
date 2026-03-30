/**
 * TradingView Playwright 操作封装
 * 提供常用 Playwright 操作的封装函数，用于自动化 TradingView 图表分析
 */

/**
 * 最小化 Strategy Report 窗口
 * 检测 Strategy Report 窗口是否打开，如果打开则点击最小化按钮
 *
 * @param {import('playwright').Page} page - Playwright Page 对象
 * @returns {Promise<boolean>} 返回是否成功最小化
 */
async function minimizeStrategyReport(page) {
  try {
    console.log('[tradingview] 检查 Strategy Report 窗口状态...');

    // 获取页面快照检查 Strategy Report 状态
    const snapshot = await page.accessibility.snapshot();

    // 将快照转换为文本以便搜索
    const snapshotText = JSON.stringify(snapshot);

    // 检查是否存在 "Close Strategy Report" 或 "Minimize panel" 按钮
    const hasOpenReport = snapshotText.includes('Close Strategy Report') ||
                          snapshotText.includes('Minimize panel');

    if (!hasOpenReport) {
      console.log('[tradingview] Strategy Report 窗口已关闭，无需操作');
      return false;
    }

    console.log('[tradingview] Strategy Report 窗口已打开，尝试最小化...');

    // 尝试点击最小化按钮
    const minimizeButton = page.getByRole('button', { name: /minimize panel|close strategy report/i })
      .or(page.locator('button:has-text("Minimize panel")'))
      .or(page.locator('button:has-text("Close Strategy Report")'));

    // 检查按钮是否存在
    const buttonCount = await minimizeButton.count();

    if (buttonCount === 0) {
      console.log('[tradingview] 未找到最小化按钮，Strategy Report 可能已在正确状态');
      return false;
    }

    // 点击第一个找到的最小化按钮
    await minimizeButton.first().click();
    console.log('[tradingview] 成功点击最小化按钮');

    // 等待窗口关闭
    await page.waitForTimeout(1000);

    console.log('[tradingview] Strategy Report 窗口已最小化');
    return true;
  } catch (error) {
    console.error('[tradingview] 最小化 Strategy Report 时出错:', error.message);
    return false;
  }
}

/**
 * 切换股票代码
 * 点击图表上的股票名称按钮，输入目标股票代码并提交
 *
 * @param {import('playwright').Page} page - Playwright Page 对象
 * @param {string} symbol - 目标股票代码（如 AAPL、TSLA、NVDA）
 * @returns {Promise<boolean>} 返回是否成功切换
 */
async function switchSymbol(page, symbol) {
  try {
    console.log(`[tradingview] 开始切换股票代码到: ${symbol}`);

    // 等待页面稳定
    await page.waitForTimeout(500);

    // 查找股票名称按钮（通常在左上角或顶部工具栏）
    const symbolButton = page.locator('[data-symbol], .symbol, [class*="symbol"]')
      .or(page.locator('button:has-text(/^[A-Z]{1,5}$/)'))
      .or(page.getByRole('button').filter({ hasText: /^[A-Z]{1,5}$/ }))
      .first();

    const buttonCount = await symbolButton.count();

    if (buttonCount === 0) {
      console.log('[tradingview] 未找到股票名称按钮');
      return false;
    }

    console.log('[tradingview] 找到股票名称按钮，点击中...');
    await symbolButton.click();
    console.log('[tradingview] 已点击股票名称按钮');

    // 等待搜索框出现
    await page.waitForTimeout(1000);

    // 查找搜索框并输入股票代码
    const searchBox = page.getByRole('textbox', { name: /search|symbol|ticker/i })
      .or(page.locator('input[placeholder*="Search"]'))
      .or(page.locator('input[placeholder*="Symbol"]'))
      .or(page.locator('input[type="text"]').filter({ hasText: '' }))
      .first();

    const searchBoxCount = await searchBox.count();

    if (searchBoxCount === 0) {
      console.log('[tradingview] 未找到搜索框');
      return false;
    }

    console.log(`[tradingview] 在搜索框中输入股票代码: ${symbol}`);
    await searchBox.clear();
    await searchBox.fill(symbol);
    await searchBox.press('Enter');

    console.log('[tradingview] 已提交股票代码');

    // 等待图表加载
    await page.waitForTimeout(2000);

    console.log(`[tradingview] 成功切换到股票: ${symbol}`);
    return true;
  } catch (error) {
    console.error('[tradingview] 切换股票代码时出错:', error.message);
    return false;
  }
}

/**
 * 截取图表截图
 * 等待图表加载完成后，截取当前视口的截图并保存为 JPEG 格式
 *
 * @param {import('playwright').Page} page - Playwright Page 对象
 * @param {string} outputPath - 输出文件路径（如 data/analysis/2024-01-01-AAPL-4h/screenshot.jpg）
 * @returns {Promise<boolean>} 返回是否成功截图
 */
async function takeScreenshot(page, outputPath) {
  try {
    console.log(`[tradingview] 准备截图，输出路径: ${outputPath}`);

    // 等待图表渲染完成
    await page.waitForTimeout(2000);

    // 检查输出路径目录是否存在
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(outputPath);

    if (!fs.existsSync(dir)) {
      console.log(`[tradingview] 创建输出目录: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }

    // 截取当前视口的截图，保存为 JPEG 格式
    await page.screenshot({
      path: outputPath,
      type: 'jpeg',
      quality: 90,
      fullPage: false
    });

    console.log(`[tradingview] 截图已保存到: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('[tradingview] 截图时出错:', error.message);
    return false;
  }
}

/**
 * 设置时间周期
 * 点击周期选择器并选择目标时间周期
 *
 * @param {import('playwright').Page} page - Playwright Page 对象
 * @param {string} interval - 时间周期（如 30s、1m、3m、15m、30m、1h、2h、4h、D、W、M、12M）
 * @returns {Promise<boolean>} 返回是否成功设置
 */
async function setInterval(page, interval) {
  try {
    console.log(`[tradingview] 开始设置时间周期: ${interval}`);

    // 等待页面稳定
    await page.waitForTimeout(500);

    // 查找周期选择器（通常在顶部工具栏）
    const intervalSelector = page.getByRole('button', { name: /interval|timeframe|period/i })
      .or(page.locator('[data-interval], [class*="interval"]'))
      .or(page.locator('button:has-text(/^[0-9]+[smhwdM]?$/)').filter({ hasText: interval }))
      .first();

    // 首先尝试直接点击目标周期按钮
    const targetIntervalButton = page.locator('button:has-text("' + interval + '")')
      .or(page.locator(`[data-interval="${interval}"]`))
      .or(page.locator('[role="button"]').filter({ hasText: interval }))
      .first();

    const targetButtonCount = await targetIntervalButton.count();

    if (targetButtonCount > 0) {
      console.log(`[tradingview] 找到目标周期按钮: ${interval}，点击中...`);
      await targetIntervalButton.click();
    } else {
      // 如果没有直接找到，尝试先打开周期选择器
      const selectorCount = await intervalSelector.count();

      if (selectorCount === 0) {
        console.log('[tradingview] 未找到周期选择器');
        return false;
      }

      console.log('[tradingview] 点击周期选择器...');
      await intervalSelector.click();
      await page.waitForTimeout(500);

      // 在弹出的菜单中查找并点击目标周期
      const intervalOption = page.getByRole('menuitem', { name: interval })
        .or(page.locator(`[data-value="${interval}"]`))
        .or(page.locator('div:has-text("' + interval + '")'))
        .first();

      const optionCount = await intervalOption.count();

      if (optionCount === 0) {
        console.log(`[tradingview] 未找到周期选项: ${interval}`);
        return false;
      }

      console.log(`[tradingview] 选择周期选项: ${interval}`);
      await intervalOption.click();
    }

    // 等待周期切换
    await page.waitForTimeout(1000);

    console.log(`[tradingview] 成功设置时间周期: ${interval}`);
    return true;
  } catch (error) {
    console.error('[tradingview] 设置时间周期时出错:', error.message);
    return false;
  }
}

// 导出所有函数
module.exports = {
  minimizeStrategyReport,
  switchSymbol,
  takeScreenshot,
  setInterval
};
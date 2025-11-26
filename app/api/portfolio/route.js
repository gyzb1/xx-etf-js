/**
 * 红利组合API - 完全参照xx-etf Python项目实现
 * 使用聚源AIDB获取股息率数据
 */

import { NextResponse } from 'next/server';

// 强制动态渲染
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 聚源客户端（内联实现，避免模块导入问题）
class JuyuanAIDBClient {
  constructor({ appKey, appSecret, env = 'prd' }) {
    this.appKey = appKey;
    this.appSecret = appSecret;
    this.env = env;

    if (env === 'sandbox') {
      this.baseUrl = 'https://sandbox.hs.net/gildatacustomization/v1';
      this.authUrl = 'https://sandbox.hscloud.cn/oauth2/oauth2/token';
    } else {
      this.baseUrl = 'https://open.hs.net/gildatacustomization/v1';
      this.authUrl = 'https://open.hscloud.cn/oauth2/oauth2/token';
    }

    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  async getAccessToken(forceRefresh = false) {
    // 如果强制刷新，或者 token 不存在/已过期，则获取新 token
    if (!forceRefresh && this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    console.log('[聚源] 获取新的 access token...');
    const credentials = Buffer.from(`${this.appKey}:${this.appSecret}`, 'utf8').toString('base64');

    const res = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to get access token: ${res.status} ${text}`);
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    
    // 提前刷新时间：取 expiresIn 的 10% 或 60秒，取较小值
    const refreshBuffer = Math.min(Math.floor(expiresIn * 0.1), 60);
    const effectiveExpiry = Math.max(expiresIn - refreshBuffer, 60); // 至少保留60秒
    
    this.tokenExpiresAt = new Date(Date.now() + effectiveExpiry * 1000);
    
    console.log(`[聚源] Token 获取成功，原始有效期 ${expiresIn}秒，实际使用 ${effectiveExpiry}秒，过期时间 ${this.tokenExpiresAt.toLocaleTimeString()}`);
    return this.accessToken;
  }

  async nlQuery({ query, answerType = 2, limit = 10 }, retryCount = 0) {
    const url = `${this.baseUrl}/nl_query`;
    const token = await this.getAccessToken();
    
    const payload = {
      query,
      answerType,
      limit: Math.min(limit, 10000),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      
      // 如果是 token 过期错误，强制刷新 token 并重试一次
      if (res.status === 401 && text.includes('invalid_token') && retryCount === 0) {
        console.log('[聚源] Token 过期，强制刷新后重试...');
        // 强制获取新 token
        await this.getAccessToken(true);
        // 等待一小段时间，确保新 token 生效
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.nlQuery({ query, answerType, limit }, retryCount + 1);
      }
      
      throw new Error(`Juyuan nl_query failed: ${res.status} ${text}`);
    }

    const result = await res.json();

    if (result.answer || result.data || result.querySql) {
      return result;
    }

    throw new Error('Juyuan nl_query returned empty result');
  }

  // 结构化查询接口 - 直接使用SQL查询
  async sqlQuery(sql, retryCount = 0) {
    const url = `${this.baseUrl}/sql_query`;
    const token = await this.getAccessToken();
    
    const payload = { sql };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      
      if (res.status === 401 && text.includes('invalid_token') && retryCount === 0) {
        console.log('[聚源] Token 过期，刷新后重试...');
        await this.getAccessToken(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.sqlQuery(sql, retryCount + 1);
      }
      
      throw new Error(`Juyuan sql_query failed: ${res.status} ${text}`);
    }

    return await res.json();
  }
}

function createJuyuanClient() {
  const appKey = process.env.JUYUAN_APP_KEY;
  const appSecret = process.env.JUYUAN_APP_SECRET;
  const env = process.env.JUYUAN_ENV || 'prd';

  console.log('[聚源] 环境变量检查:');
  console.log(`  - APP_KEY: ${appKey ? '已设置 (' + appKey.slice(0, 10) + '...)' : '未设置'}`);
  console.log(`  - APP_SECRET: ${appSecret ? '已设置 (' + appSecret.slice(0, 10) + '...)' : '未设置'}`);
  console.log(`  - ENV: ${env}`);

  if (!appKey || !appSecret) {
    throw new Error('JUYUAN_APP_KEY or JUYUAN_APP_SECRET not set in environment');
  }

  return new JuyuanAIDBClient({ appKey, appSecret, env });
}

/**
 * 从聚源AIDB获取扣非净利润数据
 * 筛选出前一年扣非净利润为正的股票
 */
async function getProfitableStocks(stockNames) {
  try {
    console.log(`[聚源] 开始查询扣非净利润数据，待筛选股票: ${stockNames.length}只`);
    
    const client = createJuyuanClient();
    
    // 使用更精确的查询语句
    const query = `A股市场最近一年扣除非经常性损益后的净利润大于0的股票`;
    console.log(`[聚源] 查询语句: ${query}`);
    
    const result = await client.nlQuery({
      query,
      answerType: 2,
      limit: 5000
    });
    
    if (!result || !result.data) {
      console.warn('[聚源] 扣非净利润数据返回空，跳过筛选');
      console.warn('[聚源] 返回所有候选股票（不进行盈利筛选）');
      return new Set(stockNames); // 如果查询失败，返回所有股票
    }
    
    const profitableStocks = new Set();
    
    // 解析数据
    for (const group of result.data) {
      if (!group.valueInfo) continue;
      
      const indicatorName = (group.indicatorEngName || '').toLowerCase();
      console.log(`[聚源] 处理盈利指标: ${group.indicatorEngName}`);
      
      for (const item of group.valueInfo) {
        const stockName = item.secuAbbr || '';
        
        // 获取扣非净利润（尝试多个可能的字段名）
        const profit = Number(
          item.deducted_profit ?? 
          item.deductedProfit ??
          item.net_profit_deducted ??
          item.netProfitDeducted ??
          item.value ??
          0
        );
        
        // 扣非净利润为正
        if (stockName && profit > 0) {
          profitableStocks.add(stockName);
          console.log(`[聚源] ✓ ${stockName} - 扣非净利润: ${profit.toFixed(2)}`);
        }
      }
    }
    
    console.log(`[聚源] 找到 ${profitableStocks.size} 只扣非净利润为正的股票`);
    
    // 如果没有找到任何盈利股票，返回所有候选股票（避免过滤掉所有股票）
    if (profitableStocks.size === 0) {
      console.warn('[聚源] 未找到盈利股票，返回所有候选股票');
      return new Set(stockNames);
    }
    
    return profitableStocks;
    
  } catch (error) {
    console.error('[聚源] 获取扣非净利润数据失败:', error.message);
    // 如果查询失败，返回所有股票（不进行筛选）
    console.warn('[聚源] 查询失败，返回所有候选股票');
    return new Set(stockNames);
  }
}

/**
 * 从东财根据股票名称查询代码
 * 使用搜索接口，一次查一只
 */
async function getStockCodeByName(stockName) {
  try {
    // 使用东财搜索接口
    const url = `http://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(stockName)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=5`;
    const res = await fetch(url);
    
    if (!res.ok) return null;
    
    const data = await res.json();
    if (data.QuotationCodeTable && data.QuotationCodeTable.Data) {
      for (const item of data.QuotationCodeTable.Data) {
        // 匹配股票名称
        if (item.Name === stockName || item.SecurityTypeName === stockName) {
          // 返回代码（去掉市场后缀）
          const code = item.Code.split('.')[0];
          return code;
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 批量获取股票代码
 */
async function batchGetStockCodes(stockNames) {
  console.log(`[东财] 开始批量查询 ${stockNames.length} 只股票的代码...`);
  
  const nameToCode = new Map();
  let successCount = 0;
  
  // 为了避免请求过快，每次查询间隔50ms
  for (let i = 0; i < stockNames.length; i++) {
    const name = stockNames[i];
    const code = await getStockCodeByName(name);
    
    if (code) {
      nameToCode.set(name, code);
      successCount++;
      
      if (successCount <= 5) {
        console.log(`[东财] ✓ ${name} → ${code}`);
      }
    } else {
      if (i < 3) {
        console.log(`[东财] ✗ ${name} → 未找到`);
      }
    }
    
    // 间隔50ms
    if (i < stockNames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  console.log(`[东财] 批量查询完成: 成功 ${successCount}/${stockNames.length}`);
  return nameToCode;
}

/**
 * 从聚源AIDB获取高股息率股票
 * 并筛选出扣非净利润为正的股票
 */
async function getHighDividendStocksFromJuyuan(topN = 50) {
  try {
    console.log(`[聚源] 开始获取股息率最高的前${topN}只股票...`);
    
    const client = createJuyuanClient();
    
    // 1. 查询A股高股息率股票（多查一些，因为后面要筛选）
    const query = `A股市场滚动股息率TTM最高的前${topN * 3}只股票`;
    console.log(`[聚源] 查询语句: ${query}`);
    
    const result = await client.nlQuery({
      query,
      answerType: 2,
      limit: topN * 3
    });
    
    if (!result || !result.data) {
      console.error('[聚源] 返回空数据');
      return [];
    }
    
    console.log(`[聚源] API返回成功，开始解析数据...`);
    
    const stocks = [];
    
    // 解析聚源返回的数据结构
    for (const group of result.data) {
      if (!group.valueInfo) continue;
      
      const indicatorName = (group.indicatorEngName || '').toLowerCase();
      console.log(`[聚源] 处理指标: ${group.indicatorEngName}`);
      
      // 检查是否是股息率相关指标
      if (!indicatorName.includes('dividend')) continue;
      
      for (const item of group.valueInfo) {
        const stockName = item.secu_abbr || item.secuAbbr || '';
        
        // 获取股息率（尝试多个可能的字段名）
        const dividendYield = Number(
          item.dividend_ratio_ttm ?? 
          item.dividend_yield ?? 
          item.dividendYield ??
          item.dividendRatioTtm ??
          0
        );
        
        if (stockName && dividendYield > 0) {
          stocks.push({
            code: stockName, // 暂时用名称，后面批量查询代码
            name: stockName,
            dividend_yield: dividendYield,
          });
        }
      }
    }
    
    console.log(`[聚源] 共解析出 ${stocks.length} 只有效股票`);
    
    // 2. 获取扣非净利润为正的股票列表
    // 添加延迟，避免聚源API频率限制
    console.log('[聚源] 等待2秒后查询扣非净利润数据，避免API频率限制...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const stockNames = stocks.map(s => s.name);
    const profitableStocks = await getProfitableStocks(stockNames);
    
    // 3. 筛选出扣非净利润为正的股票
    const filteredStocks = stocks.filter(stock => profitableStocks.has(stock.name));
    console.log(`[聚源] 筛选后剩余 ${filteredStocks.length} 只股票（扣非净利润为正）`);
    
    // 4. 按股息率排序，取前N只
    filteredStocks.sort((a, b) => b.dividend_yield - a.dividend_yield);
    const topStocks = filteredStocks.slice(0, topN);
    
    console.log(`[聚源] 返回前${topN}只高股息率股票`);
    
    // 5. 批量查询这些股票的代码
    const stockNamesToQuery = topStocks.map(s => s.name);
    const nameToCode = await batchGetStockCodes(stockNamesToQuery);
    
    // 6. 更新股票代码，过滤掉没有代码的股票
    const stocksWithCode = [];
    for (const stock of topStocks) {
      const code = nameToCode.get(stock.name);
      if (code) {
        stock.code = code;
        stocksWithCode.push(stock);
      } else {
        console.warn(`[东财] ${stock.name} 未找到股票代码，将被过滤`);
      }
    }
    
    console.log(`[聚源] 最终返回 ${stocksWithCode.length} 只有代码的股票`);
    return stocksWithCode;
    
  } catch (error) {
    console.error('[聚源] 获取数据失败:', error.message);
    console.error('[聚源] 错误堆栈:', error.stack);
    throw error;
  }
}

/**
 * 从东财获取单只股票从年初到现在的历史价格
 * 使用东财免费API，更稳定可靠
 */
async function getSingleStockHistoryFromEastmoney(stockCode, stockName, isFirstStock = false) {
  try {
    // 判断市场：6开头是上海，其他是深圳
    const market = stockCode.startsWith('6') ? '1' : '0';
    const secid = `${market}.${stockCode}`;
    
    // 东财历史行情接口
    const url = `http://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=101&fqt=1&beg=20250101&end=20251231&lmt=300`;
    
    if (isFirstStock) {
      console.log(`[东财] ${stockName} (${stockCode}) 查询历史价格...`);
      console.log(`[东财] 请求URL: ${url}`);
    }
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!res.ok) {
      if (isFirstStock) {
        console.error(`[东财] ${stockName} HTTP错误: ${res.status} ${res.statusText}`);
      }
      return { prices: [] };
    }
    
    const data = await res.json();
    
    if (!data.data || !data.data.klines || data.data.klines.length === 0) {
      return { prices: [] };
    }
    
    const prices = [];
    
    // 解析K线数据
    // 格式：日期,开盘,收盘,最高,最低,成交量,成交额,振幅,涨跌幅,涨跌额,换手率
    for (const kline of data.data.klines) {
      const parts = kline.split(',');
      if (parts.length < 3) continue;
      
      const date = parts[0].replace(/-/g, ''); // 2025-01-02 -> 20250102
      const closePrice = parseFloat(parts[2]);
      
      if (closePrice > 0 && date.startsWith('2025')) {
        prices.push({
          date,
          close: closePrice,
        });
      }
    }
    
    // 按日期排序
    prices.sort((a, b) => a.date.localeCompare(b.date));
    
    if (isFirstStock) {
      console.log(`[东财] ${stockName} 获取到 ${prices.length} 个交易日数据`);
      if (prices.length > 0) {
        console.log(`[东财] ${stockName} 数据样本: ${prices[0].date} 收盘价 ${prices[0].close}`);
      }
    }
    
    return { prices };
    
  } catch (error) {
    console.log(`[东财] ${stockName} 查询异常: ${error.message}`);
    return { prices: [] };
  }
}

/**
 * 从聚源获取单只股票的最新涨跌幅
 * 先尝试查询"最新涨跌幅"，如果失败则查询最近2天收盘价自己计算
 */
async function getStockDailyChange(client, stockName) {
  try {
    // 方法1：直接查询最新涨跌幅
    let query = `查询${stockName}最新涨跌幅`;
    let result = await client.nlQuery({
      query,
      answerType: 2,
      limit: 5
    });
    
    // 尝试从返回结果中提取涨跌幅
    if (result && result.data) {
      for (const group of result.data) {
        if (!group.valueInfo) continue;
        
        for (const item of group.valueInfo) {
          // 尝试多个可能的涨跌幅字段
          let changeRate = null;
          if (item.px_change_rate !== undefined && item.px_change_rate !== null && item.px_change_rate !== '') {
            changeRate = parseFloat(item.px_change_rate);
          } else if (item.change_rate !== undefined && item.change_rate !== null && item.change_rate !== '') {
            changeRate = parseFloat(item.change_rate);
          } else if (item.pct_chg !== undefined && item.pct_chg !== null && item.pct_chg !== '') {
            changeRate = parseFloat(item.pct_chg);
          } else if (item.issue_price_change_rate !== undefined && item.issue_price_change_rate !== null && item.issue_price_change_rate !== '') {
            changeRate = parseFloat(item.issue_price_change_rate);
          }
          
          if (changeRate !== null && !isNaN(changeRate)) {
            return changeRate;
          }
        }
      }
    }
    
    // 方法2：如果方法1失败，查询最近2个交易日的收盘价，自己计算
    query = `查询${stockName}最近2个交易日的收盘价`;
    result = await client.nlQuery({
      query,
      answerType: 2,
      limit: 10
    });
    
    if (!result || !result.data) {
      return null;
    }
    
    const prices = [];
    for (const group of result.data) {
      if (!group.valueInfo) continue;
      
      for (const item of group.valueInfo) {
        const closePrice = parseFloat(item.close_price || 0);
        const date = item.endDate || item.end_date || item.trading_date || '';
        
        if (closePrice > 0 && date) {
          prices.push({
            date,
            close: closePrice,
          });
        }
      }
    }
    
    // 按日期排序
    prices.sort((a, b) => a.date.localeCompare(b.date));
    
    // 如果有至少2个交易日的数据，计算涨跌幅
    if (prices.length >= 2) {
      const latestPrice = prices[prices.length - 1];
      const prevPrice = prices[prices.length - 2];
      
      if (prevPrice.close > 0) {
        const changeRate = ((latestPrice.close / prevPrice.close - 1) * 100);
        return changeRate;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 从东财获取股票从年初到现在的历史价格
 * 使用东财免费API，稳定可靠
 */
async function getStockHistoryPricesFromEastmoney(stockCodes, stockNames) {
  const currentYear = new Date().getFullYear();
  console.log(`[东财] 开始获取 ${stockCodes.length} 只股票从${currentYear}年初至今的历史价格...`);
  
  const priceData = new Map(); // code -> [{date, close}, ...]
  const changeData = new Map(); // code -> latest_change (从历史数据计算)
  
  const startTime = Date.now();
  const historyLimit = Math.min(50, stockCodes.length);
  
  for (let i = 0; i < historyLimit; i++) {
    const code = stockCodes[i];
    const name = stockNames[i];
    
    try {
      const { prices } = await getSingleStockHistoryFromEastmoney(code, name, i === 0);
      
      if (prices.length > 0) {
        priceData.set(code, prices);
        
        // 计算上一个交易日（昨天收盘）的涨跌幅
        // prices[length-1] = 最新交易日（可能是今天或昨天）
        // prices[length-2] = 上一个交易日
        // prices[length-3] = 上上个交易日
        // 我们要的是：上一个交易日相对于上上个交易日的涨跌幅
        let dailyChange = null;
        if (prices.length >= 3) {
          // 如果有3个以上交易日，取倒数第2个相对于倒数第3个
          const yesterdayPrice = prices[prices.length - 2];
          const dayBeforePrice = prices[prices.length - 3];
          if (dayBeforePrice.close > 0 && yesterdayPrice.close > 0) {
            dailyChange = ((yesterdayPrice.close / dayBeforePrice.close - 1) * 100);
          }
        } else if (prices.length === 2) {
          // 如果只有2个交易日，取最新的相对于前一个
          const latestPrice = prices[prices.length - 1];
          const prevPrice = prices[prices.length - 2];
          if (prevPrice.close > 0 && latestPrice.close > 0) {
            dailyChange = ((latestPrice.close / prevPrice.close - 1) * 100);
          }
        }
        changeData.set(code, dailyChange);
        
        if ((i + 1) % 5 === 0 || i === historyLimit - 1) {
          const changeStr = dailyChange !== null ? `昨日涨跌 ${dailyChange.toFixed(2)}%` : '无涨跌幅';
          console.log(`[东财] 进度: ${i + 1}/${historyLimit} (${Math.round((i + 1) / historyLimit * 100)}%) - ${name}: ${prices.length} 个交易日, ${changeStr}`);
        }
      } else {
        console.log(`[东财] ✗ ${i + 1}/${historyLimit} ${name}: 无数据`);
        changeData.set(code, null);
      }
    } catch (error) {
      console.log(`[东财] ✗ ${i + 1}/${historyLimit} ${name}: 查询出错 - ${error.message}`);
      changeData.set(code, null);
    }
    
    // 间隔20ms，加快查询速度
    if (i < historyLimit - 1) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const successRate = ((priceData.size / historyLimit) * 100).toFixed(1);
  console.log(`[东财] 完成: 获取到 ${priceData.size}/${historyLimit} 只股票的历史价格 (成功率 ${successRate}%)，总耗时 ${totalElapsed} 秒`);
  
  // 如果成功率低于80%，打印失败的股票
  if (priceData.size < historyLimit * 0.8) {
    console.warn(`[东财] ⚠️ 成功率较低 (${successRate}%)，以下股票未获取到数据:`);
    for (let i = 0; i < historyLimit; i++) {
      const code = stockCodes[i];
      if (!priceData.has(code)) {
        console.warn(`  - ${stockNames[i]} (${code})`);
      }
    }
  }
  
  // 打印数据统计
  if (priceData.size > 0) {
    const dataCounts = Array.from(priceData.values()).map(p => p.length);
    const avgCount = (dataCounts.reduce((a, b) => a + b, 0) / dataCounts.length).toFixed(0);
    const minCount = Math.min(...dataCounts);
    const maxCount = Math.max(...dataCounts);
    console.log(`[东财] 数据统计: 平均 ${avgCount} 个交易日，范围 ${minCount}-${maxCount}`);
  }
  
  return { priceData, changeData };
}

/**
 * 判断是否是交易日且已收盘
 * A股交易时间：周一至周五 9:30-15:00
 */
function isTradingDayClosed() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const day = now.getDay(); // 0=周日, 1-5=周一至周五, 6=周六
  
  // 周末不是交易日
  if (day === 0 || day === 6) {
    return false;
  }
  
  // 交易日，判断是否已收盘（15:00之后算已收盘）
  if (hour > 15 || (hour === 15 && minute >= 0)) {
    return true;
  }
  
  return false;
}

/**
 * 计算组合净值曲线
 */
function calculatePortfolioNav(stocks, priceData) {
  console.log('[计算] 开始计算组合净值曲线...');
  
  // 获取所有日期
  const allDates = new Set();
  for (const prices of priceData.values()) {
    prices.forEach(p => allDates.add(p.date));
  }
  
  let sortedDates = Array.from(allDates).sort();
  console.log(`[计算] 共 ${sortedDates.length} 个交易日`);
  
  if (sortedDates.length === 0) {
    return [];
  }
  
  // 如果今天还在交易中（未收盘），移除最后一个交易日
  const isClosed = isTradingDayClosed();
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const latestDate = sortedDates[sortedDates.length - 1];
  
  if (!isClosed && latestDate === today) {
    console.log(`[计算] 今日尚未收盘，净值曲线截止到昨天 (${sortedDates[sortedDates.length - 2]})`);
    sortedDates = sortedDates.slice(0, -1);
  } else {
    console.log(`[计算] 净值曲线截止到 ${latestDate}`);
  }
  
  if (sortedDates.length === 0) {
    return [];
  }
  
  // 计算每日净值（基准 1.0，累计计算）
  const navCurve = [];
  const weight = 1 / stocks.length; // 等权重
  let cumulativeNav = 1.0; // 初始净值 1.0
  
  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i];
    const prevDate = i > 0 ? sortedDates[i - 1] : null;
    
    let dailyReturn = 0;
    let validStocks = 0;
    
    for (const stock of stocks) {
      const prices = priceData.get(stock.code);
      if (!prices || prices.length === 0) continue;
      
      const priceOnDate = prices.find(p => p.date === date);
      
      if (i === 0) {
        // 第一天，收益率为 0
        validStocks++;
      } else {
        // 计算相对于前一天的涨跌幅
        const pricePrev = prices.find(p => p.date === prevDate);
        
        if (priceOnDate && pricePrev && pricePrev.close > 0) {
          const stockReturn = (priceOnDate.close / pricePrev.close - 1);
          dailyReturn += stockReturn * weight;
          validStocks++;
        }
      }
    }
    
    if (validStocks > 0) {
      // 累计净值 = 前一日净值 × (1 + 当日收益率)
      if (i > 0) {
        cumulativeNav = cumulativeNav * (1 + dailyReturn);
      }
      
      const totalReturn = (cumulativeNav - 1.0) * 100;
      
      navCurve.push({
        date,
        nav: Number(cumulativeNav.toFixed(6)),
        return: Number(totalReturn.toFixed(2)),
      });
    }
  }
  
  console.log(`[计算] 净值曲线计算完成，共 ${navCurve.length} 个数据点`);
  
  if (navCurve.length > 0) {
    const firstPoint = navCurve[0];
    const lastPoint = navCurve[navCurve.length - 1];
    console.log(`[计算] 起始: ${firstPoint.date} NAV=${firstPoint.nav}`);
    console.log(`[计算] 结束: ${lastPoint.date} NAV=${lastPoint.nav} 收益=${lastPoint.return}%`);
  } else {
    console.warn('[计算] ⚠️ 净值曲线为空！');
  }
  
  return navCurve;
}

/**
 * 构建等权重组合
 */
async function buildPortfolio(stocks, topN) {
  const weight = 100 / stocks.length;
  const totalDividendYield = stocks.reduce((sum, s) => sum + s.dividend_yield, 0);
  const avgDividendYield = totalDividendYield / stocks.length;
  
  const portfolioId = `DIV_JUYUAN_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 15)}`;
  
  // 获取历史价格并计算净值曲线
  let navCurve = [];
  let priceData = new Map();
  let changeData = new Map();
  let portfolioStocks = [];
  
  try {
    const validStocks = stocks.filter(s => s.code && s.code.length === 6);
    const stockCodes = validStocks.map(s => s.code);
    const stockNames = validStocks.map(s => s.name);
    console.log(`[计算] 准备获取 ${stockCodes.length} 只股票的历史数据`);
    
    const result = await getStockHistoryPricesFromEastmoney(stockCodes, stockNames);
    priceData = result.priceData;
    changeData = result.changeData;
    
    console.log(`[计算] 获取到 ${priceData.size} 只股票的历史价格数据`);
    
    if (priceData.size > 0) {
      console.log('[计算] 开始计算净值曲线...');
      navCurve = calculatePortfolioNav(validStocks, priceData);
      console.log(`[计算] 净值曲线计算完成，共 ${navCurve.length} 个数据点`);
      
      // 为每只股票添加今日涨跌幅（使用聚源返回的数据）
      portfolioStocks = validStocks.map(stock => {
        const prices = priceData.get(stock.code);
        const daily_change = changeData.get(stock.code);
        let latest_price = null;
        
        if (prices && prices.length > 0) {
          latest_price = prices[prices.length - 1].close;
        }
        
        return {
          code: stock.code,
          name: stock.name,
          dividend_yield: Number(stock.dividend_yield.toFixed(2)),
          weight: Number(weight.toFixed(2)),
          daily_change: daily_change !== null && daily_change !== undefined ? Number(daily_change.toFixed(2)) : null,
          latest_price,
        };
      });
    } else {
      console.warn('[计算] 未获取到历史价格数据，跳过净值曲线计算');
      portfolioStocks = stocks.map(stock => ({
        code: stock.code,
        name: stock.name,
        dividend_yield: Number(stock.dividend_yield.toFixed(2)),
        weight: Number(weight.toFixed(2)),
        daily_change: null,
        latest_price: null,
      }));
    }
  } catch (error) {
    console.warn('[计算] 净值曲线计算失败:', error.message);
    portfolioStocks = stocks.map(stock => ({
      code: stock.code,
      name: stock.name,
      dividend_yield: Number(stock.dividend_yield.toFixed(2)),
      weight: Number(weight.toFixed(2)),
      daily_change: null,
      latest_price: null,
    }));
  }
  
  // 计算基金今日涨跌幅
  let fund_daily_change = null;
  let latest_nav = null;
  let prev_nav = null;
  
  if (navCurve.length >= 2) {
    latest_nav = navCurve[navCurve.length - 1].nav;
    prev_nav = navCurve[navCurve.length - 2].nav;
    fund_daily_change = Number((((latest_nav / prev_nav - 1) * 100).toFixed(2)));
  } else if (navCurve.length === 1) {
    latest_nav = navCurve[0].nav;
    fund_daily_change = 0;
  }
  
  return {
    portfolio_id: portfolioId,
    creation_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
    update_time: new Date().toISOString().slice(0, 19).replace('T', ' '), // 更新时间
    strategy_version: 'v2-juyuan',
    stock_count: portfolioStocks.length,
    selection_criteria: {
      data_source: '聚源AIDB',
      method: '自然语言查询',
      profitability: '前一年扣非净利润为正',
      dividend: `股息率TTM最高前${topN}只`,
    },
    avg_dividend_yield: Number(avgDividendYield.toFixed(2)),
    weight_method: 'equal',
    latest_nav, // 最新净值
    fund_daily_change, // 基金今日涨跌幅
    stocks: portfolioStocks,
    nav_curve: navCurve, // 净值曲线
  };
}

/**
 * GET /api/portfolio
 * 获取红利组合
 */
export async function GET(request) {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('[API] 开始处理组合请求');
    console.log('='.repeat(70));
    
    const { searchParams } = new URL(request.url);
    const topN = Number(searchParams.get('topN') || 50) || 50;
    
    console.log(`[API] 参数: topN=${topN}`);
    
    // 从聚源获取高股息率股票
    const stocks = await getHighDividendStocksFromJuyuan(topN);
    
    if (!stocks || stocks.length === 0) {
      throw new Error('未能获取到股票数据');
    }
    
    // 构建组合
    const portfolio = await buildPortfolio(stocks, topN);
    
    console.log(`[API] 组合构建成功:`);
    console.log(`  - 股票数量: ${portfolio.stock_count}`);
    console.log(`  - 平均股息率: ${portfolio.avg_dividend_yield}%`);
    console.log(`  - 前5只股票:`);
    if (portfolio.stocks && portfolio.stocks.length > 0) {
      portfolio.stocks.slice(0, 5).forEach((s, i) => {
        console.log(`    ${i + 1}. ${s.name} - ${s.dividend_yield}%`);
      });
    }
    console.log('='.repeat(70) + '\n');
    
    return NextResponse.json(portfolio);
    
  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('[API] 错误:', error.message);
    console.error('[API] 堆栈:', error.stack);
    console.error('='.repeat(70) + '\n');
    
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

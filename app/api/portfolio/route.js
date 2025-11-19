/**
 * 红利组合API - 完全参照xx-etf Python项目实现
 * 使用聚源AIDB获取股息率数据
 */

import { NextResponse } from 'next/server';

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

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

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
    this.tokenExpiresAt = new Date(Date.now() + (expiresIn - 300) * 1000);
    return this.accessToken;
  }

  async nlQuery({ query, answerType = 2, limit = 10 }) {
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
      throw new Error(`Juyuan nl_query failed: ${res.status} ${text}`);
    }

    const result = await res.json();

    if (result.answer || result.data || result.querySql) {
      return result;
    }
    if (result.code === 200 || result.success) {
      return result.data || result;
    }

    throw new Error(`Juyuan nl_query error: ${JSON.stringify(result)}`);
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
 * 从东方财富获取所有A股的代码映射（免费、稳定、完整）
 */
async function getStockCodeMapping() {
  try {
    console.log('[东财] 获取A股代码映射...');
    
    // 东方财富的A股列表API，包含完整的代码和名称
    const url = 'http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5000&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14';
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!res.ok) {
      throw new Error(`东财API请求失败: ${res.status}`);
    }
    
    const data = await res.json();
    if (!data.data || !data.data.diff) {
      throw new Error('东财API返回数据格式错误');
    }
    
    // 建立名称到代码的映射
    const nameToCode = new Map();
    for (const item of data.data.diff) {
      if (item.f12 && item.f14) {
        nameToCode.set(item.f14, item.f12); // f14=名称, f12=代码
      }
    }
    
    console.log(`[东财] 获取到 ${nameToCode.size} 只股票的代码映射`);
    return nameToCode;
    
  } catch (error) {
    console.error('[东财] 获取代码映射失败:', error.message);
    return new Map();
  }
}

/**
 * 填充缺失的股票代码（使用东方财富数据）
 */
async function fillMissingStockCodes(stocks) {
  try {
    console.log('[代码填充] 开始填充缺失的股票代码...');
    
    // 获取需要查询代码的股票名称
    const stocksNeedingCode = stocks.filter(s => s._needsCodeLookup);
    if (stocksNeedingCode.length === 0) {
      console.log('[代码填充] 无需填充');
      return;
    }
    
    console.log(`[代码填充] 需要填充 ${stocksNeedingCode.length} 只股票的代码`);
    
    // 从东方财富获取完整的代码映射
    const nameToCode = await getStockCodeMapping();
    
    if (nameToCode.size === 0) {
      console.warn('[代码填充] 未获取到代码映射，跳过填充');
      return;
    }
    
    // 填充代码
    let filledCount = 0;
    for (const stock of stocks) {
      if (stock._needsCodeLookup) {
        const code = nameToCode.get(stock.name);
        if (code) {
          stock.code = code;
          delete stock._needsCodeLookup;
          filledCount++;
          console.log(`[代码填充] ${stock.name} -> ${code}`);
        } else {
          console.warn(`[代码填充] 未找到 ${stock.name} 的代码`);
          stock.code = stock.name.substring(0, 6); // 后备方案
        }
      }
    }
    
    console.log(`[代码填充] 成功填充 ${filledCount}/${stocksNeedingCode.length} 个股票代码`);
    
  } catch (error) {
    console.error('[代码填充] 填充失败:', error.message);
  }
}

/**
 * 从聚源AIDB获取高股息率股票
 * 并筛选出扣非净利润为正的股票
 */
async function getHighDividendStocksFromJuyuan(topN = 50) {
  try {
    console.log(`[聚源] 开始获取股息率最高的前${topN}只股票...`);
    console.log(`[聚源] 当前时间: ${new Date().toISOString()}`);
    
    const client = createJuyuanClient();
    
    // 1. 查询A股高股息率股票（多查一些，因为后面要筛选）
    const queryLimit = Math.min(topN * 5, 500); // 增加查询数量，但不超过500
    const query = `A股市场滚动股息率TTM最高的前${queryLimit}只股票`;
    console.log(`[聚源] 查询语句: ${query}`);
    console.log(`[聚源] 查询限制: ${queryLimit}只`);
    
    const startTime = Date.now();
    const result = await client.nlQuery({
      query,
      answerType: 2,
      limit: queryLimit
    });
    const duration = Date.now() - startTime;
    console.log(`[聚源] API响应时间: ${duration}ms`);
    
    // 打印返回数据的结构样本
    if (result && result.data && result.data.length > 0) {
      console.log('[聚源] 数据结构样本:');
      const sample = result.data[0];
      console.log(`  - 指标名: ${sample.indicatorEngName}`);
      if (sample.valueInfo && sample.valueInfo.length > 0) {
        const item = sample.valueInfo[0];
        console.log(`  - 字段: ${Object.keys(item).join(', ')}`);
        console.log(`  - 样本数据:`, JSON.stringify(item).slice(0, 200));
      }
    }
    
    if (!result || !result.data) {
      console.error('[聚源] 返回空数据');
      console.error('[聚源] 完整响应:', JSON.stringify(result).slice(0, 500));
      return [];
    }
    
    console.log(`[聚源] API返回成功，数据组数: ${result.data.length}`);
    
    const stocks = [];
    
    // 解析聚源返回的数据结构
    for (const group of result.data) {
      if (!group.valueInfo) continue;
      
      const indicatorName = (group.indicatorEngName || '').toLowerCase();
      console.log(`[聚源] 处理指标: ${group.indicatorEngName}`);
      
      // 检查是否是股息率相关指标
      if (!indicatorName.includes('dividend')) continue;
      
      for (const item of group.valueInfo) {
        const stockName = item.secuAbbr || item.securityName || item.stockName || '';
        
        // 获取股息率（尝试多个可能的字段名）
        const dividendYield = Number(
          item.dividend_ratio_ttm ?? 
          item.dividend_yield ?? 
          item.dividendYield ??
          item.dividendRatioTtm ??
          item.value ??
          0
        );
        
        if (stockName && dividendYield > 0) {
          // 聚源的股息率查询不返回股票代码，需要后续查询
          stocks.push({
            code: '', // 稍后填充
            name: stockName,
            dividend_yield: dividendYield,
            _needsCodeLookup: true
          });
          
          if (stocks.length <= 10) {
            console.log(`[聚源] 找到: ${stockName} | 股息率: ${dividendYield.toFixed(2)}%`);
          }
        }
      }
    }
    
    console.log(`[聚源] 共解析出 ${stocks.length} 只有效股票`);
    
    if (stocks.length === 0) {
      console.error('[聚源] 警告：未解析出任何股票数据！');
      console.error('[聚源] 请检查API返回的数据结构');
    }
    
    // 检查有多少股票缺少代码
    const missingCodeCount = stocks.filter(s => s._needsCodeLookup).length;
    if (missingCodeCount > 0) {
      console.warn(`[聚源] 警告：${missingCodeCount} 只股票缺少股票代码`);
      // 使用东方财富API填充股票代码（免费、稳定、完整）
      await fillMissingStockCodes(stocks);
    }
    
    // 2. 获取扣非净利润为正的股票列表
    const stockNames = stocks.map(s => s.name);
    const profitableStocks = await getProfitableStocks(stockNames);
    
    // 3. 筛选出扣非净利润为正的股票
    const filteredStocks = stocks.filter(stock => profitableStocks.has(stock.name));
    console.log(`[聚源] 筛选后剩余 ${filteredStocks.length} 只股票（扣非净利润为正）`);
    
    // 4. 按股息率排序，取前N只
    filteredStocks.sort((a, b) => b.dividend_yield - a.dividend_yield);
    const topStocks = filteredStocks.slice(0, topN);
    
    // 5. 清理内部标记
    topStocks.forEach(stock => {
      delete stock._needsCodeLookup;
      // 如果代码仍然是 UNKNOWN_ 开头，尝试提取简短代码
      if (stock.code.startsWith('UNKNOWN_')) {
        stock.code = stock.name.substring(0, 6);
      }
    });
    
    console.log(`[聚源] 返回前${topN}只高股息率股票`);
    return topStocks;
    
  } catch (error) {
    console.error('[聚源] 获取数据失败:', error.message);
    console.error('[聚源] 错误堆栈:', error.stack);
    throw error;
  }
}

/**
 * 构建等权重组合
 */
function buildPortfolio(stocks, topN) {
  const weight = 100 / stocks.length;
  const totalDividendYield = stocks.reduce((sum, s) => sum + s.dividend_yield, 0);
  const avgDividendYield = totalDividendYield / stocks.length;
  
  const portfolioStocks = stocks.map(stock => ({
    code: stock.code,
    name: stock.name,
    dividend_yield: Number(stock.dividend_yield.toFixed(2)),
    weight: Number(weight.toFixed(2)),
  }));
  
  const portfolioId = `DIV_JUYUAN_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 15)}`;
  
  return {
    portfolio_id: portfolioId,
    creation_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
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
    stocks: portfolioStocks,
  };
}

// Vercel运行时配置
export const runtime = 'nodejs';
export const maxDuration = 60; // 最长60秒（需要Pro计划，Hobby是10秒）

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
    const portfolio = buildPortfolio(stocks, topN);
    
    console.log(`[API] 组合构建成功:`);
    console.log(`  - 股票数量: ${portfolio.stock_count}`);
    console.log(`  - 平均股息率: ${portfolio.avg_dividend_yield}%`);
    console.log(`  - 前5只股票:`);
    portfolio.stocks.slice(0, 5).forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.name} - ${s.dividend_yield}%`);
    });
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

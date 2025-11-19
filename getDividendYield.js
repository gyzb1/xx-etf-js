/**
 * 股息率数据获取工具 (Node.js)
 * 参考 Python 版本实现，提供多种方式获取股息率数据
 */

const { createJuyuanClientFromEnv } = require('./lib/juyuanClient');

/**
 * 从聚源AIDB获取股息率数据
 * @param {Array<string>} stockNames - 股票名称列表（可选）
 * @param {number} limit - 查询数量限制
 * @returns {Promise<Map<string, number>>} 股票名称 -> 股息率的映射
 */
async function getDividendYieldFromJuyuan(stockNames = null, limit = 1000) {
  try {
    console.log('[聚源] 获取股息率数据...');
    
    const client = createJuyuanClientFromEnv();
    const query = `A股市场滚动股息率TTM最高的前${limit}只股票`;
    console.log(`[聚源] 查询: ${query}`);
    
    const result = await client.nlQuery({ query, answerType: 2, limit });
    
    if (!result || !result.data) {
      console.warn('[聚源] 返回空数据');
      return new Map();
    }
    
    const dividendMap = new Map();
    const stockNameSet = stockNames ? new Set(stockNames) : null;
    
    for (const group of result.data) {
      if (!group.valueInfo) continue;
      
      const indicatorName = (group.indicatorEngName || '').toLowerCase();
      if (!indicatorName.includes('dividend')) continue;
      
      for (const item of group.valueInfo) {
        const stockName = item.secuAbbr || '';
        
        // 如果指定了股票列表，只返回列表中的股票
        if (stockNameSet && !stockNameSet.has(stockName)) continue;
        
        // 尝试获取股息率值
        const dividendYield = Number(
          item.dividend_ratio_ttm ?? 
          item.dividend_yield ?? 
          item.dividendYield ?? 
          0
        );
        
        if (!isNaN(dividendYield) && dividendYield > 0) {
          dividendMap.set(stockName, dividendYield);
        }
      }
    }
    
    console.log(`[聚源] 成功获取 ${dividendMap.size} 只股票的股息率数据`);
    return dividendMap;
    
  } catch (error) {
    console.error('[聚源] 获取股息率失败:', error.message);
    return new Map();
  }
}

/**
 * 从东方财富API获取股息率数据
 * @param {Array<string>} stockCodes - 股票代码列表（可选）
 * @returns {Promise<Map<string, number>>} 股票代码 -> 股息率的映射
 */
async function getDividendYieldFromEastMoney(stockCodes = null) {
  try {
    console.log('[东财] 获取股息率数据...');
    
    // 东财API: f12=代码, f14=名称, f127=股息率(%)
    const url = 'http://push2.eastmoney.com/api/qt/clist/get?' +
      'pn=1&pz=5000&po=1&np=1&fltt=2&invt=2&fid=f127&' +
      'fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&' +
      'fields=f12,f14,f127';
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`东财API请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.data || !data.data.diff) {
      console.warn('[东财] 返回空数据');
      return new Map();
    }
    
    const dividendMap = new Map();
    const stockCodeSet = stockCodes ? new Set(stockCodes) : null;
    
    for (const item of data.data.diff) {
      const code = item.f12;
      const name = item.f14;
      const dividendYield = Number(item.f127);
      
      if (!code || !dividendYield) continue;
      
      // 如果指定了股票列表，只返回列表中的股票
      if (stockCodeSet && !stockCodeSet.has(code)) continue;
      
      if (!isNaN(dividendYield) && dividendYield > 0) {
        dividendMap.set(code, dividendYield);
      }
    }
    
    console.log(`[东财] 成功获取 ${dividendMap.size} 只股票的股息率数据`);
    return dividendMap;
    
  } catch (error) {
    console.error('[东财] 获取股息率失败:', error.message);
    return new Map();
  }
}

/**
 * 获取股息率最高的前N只股票
 * @param {number} topN - 返回前N只股票
 * @param {boolean} useJuyuan - 是否优先使用聚源数据
 * @returns {Promise<Array<Object>>} 股票列表
 */
async function getTopDividendStocks(topN = 50, useJuyuan = true) {
  let stocks = [];
  
  if (useJuyuan) {
    try {
      // 尝试使用聚源数据
      const dividendMap = await getDividendYieldFromJuyuan(null, topN * 2);
      
      if (dividendMap.size > 0) {
        // 按股息率排序
        const sortedStocks = Array.from(dividendMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, topN);
        
        stocks = sortedStocks.map(([name, dividendYield]) => ({
          name,
          dividend_yield: dividendYield,
          data_source: 'juyuan'
        }));
        
        console.log(`使用聚源数据，获取到 ${stocks.length} 只高股息率股票`);
        return stocks;
      }
    } catch (error) {
      console.warn(`聚源数据获取失败，回退到东财: ${error.message}`);
    }
  }
  
  // 使用东财数据（回退或默认）
  const dividendMap = await getDividendYieldFromEastMoney();
  
  if (dividendMap.size === 0) {
    console.error('无法获取股息率数据');
    return [];
  }
  
  // 按股息率排序
  const sortedStocks = Array.from(dividendMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
  
  stocks = sortedStocks.map(([code, dividendYield]) => ({
    code,
    dividend_yield: dividendYield,
    data_source: 'eastmoney'
  }));
  
  console.log(`使用东财数据，获取到 ${stocks.length} 只高股息率股票`);
  return stocks;
}

/**
 * 获取指定股票列表的股息率
 * @param {Array<string>} stocks - 股票代码或名称列表
 * @param {boolean} useJuyuan - 是否使用聚源数据
 * @returns {Promise<Map<string, number>>} 股票 -> 股息率的映射
 */
async function getDividendYieldForStocks(stocks, useJuyuan = true) {
  if (useJuyuan) {
    try {
      // 假设输入的是股票名称
      return await getDividendYieldFromJuyuan(stocks);
    } catch (error) {
      console.warn(`聚源查询失败，回退到东财: ${error.message}`);
    }
  }
  
  // 使用东财数据（假设输入的是股票代码）
  return await getDividendYieldFromEastMoney(stocks);
}

/**
 * 使用示例
 */
async function demoUsage() {
  console.log('\n' + '='.repeat(70));
  console.log('股息率数据获取工具 - 使用示例');
  console.log('='.repeat(70) + '\n');
  
  // 示例1: 获取股息率最高的前20只股票（使用聚源数据）
  console.log('【示例1】获取股息率最高的前20只股票（聚源数据）');
  console.log('-'.repeat(70));
  
  let stocks = await getTopDividendStocks(20, true);
  
  if (stocks.length > 0) {
    console.log(`\n${'排名'.padEnd(6)}${'股票名称/代码'.padEnd(15)}${'股息率(%)'.padEnd(12)}${'数据源'.padEnd(10)}`);
    console.log('-'.repeat(70));
    stocks.forEach((stock, i) => {
      const nameOrCode = stock.name || stock.code || 'N/A';
      console.log(
        `${String(i + 1).padEnd(6)}${nameOrCode.padEnd(15)}` +
        `${stock.dividend_yield.toFixed(2).padEnd(12)}${stock.data_source.padEnd(10)}`
      );
    });
  } else {
    console.log('❌ 未获取到数据');
  }
  
  // 示例2: 获取股息率最高的前20只股票（使用东财数据）
  console.log('\n' + '='.repeat(70));
  console.log('【示例2】获取股息率最高的前20只股票（东财数据）');
  console.log('-'.repeat(70));
  
  stocks = await getTopDividendStocks(20, false);
  
  if (stocks.length > 0) {
    console.log(`\n${'排名'.padEnd(6)}${'股票代码'.padEnd(15)}${'股息率(%)'.padEnd(12)}${'数据源'.padEnd(10)}`);
    console.log('-'.repeat(70));
    stocks.forEach((stock, i) => {
      const code = stock.code || 'N/A';
      console.log(
        `${String(i + 1).padEnd(6)}${code.padEnd(15)}` +
        `${stock.dividend_yield.toFixed(2).padEnd(12)}${stock.data_source.padEnd(10)}`
      );
    });
  } else {
    console.log('❌ 未获取到数据');
  }
  
  // 示例3: 查询特定股票的股息率（使用聚源）
  console.log('\n' + '='.repeat(70));
  console.log('【示例3】查询特定股票的股息率（聚源数据）');
  console.log('-'.repeat(70));
  
  const targetStocks = ['中国平安', '贵州茅台', '招商银行', '长江电力', '中国神华'];
  const dividendData = await getDividendYieldForStocks(targetStocks, true);
  
  if (dividendData.size > 0) {
    console.log(`\n${'股票名称'.padEnd(15)}${'股息率(%)'.padEnd(12)}`);
    console.log('-'.repeat(70));
    for (const [name, dividendYield] of dividendData.entries()) {
      console.log(`${name.padEnd(15)}${dividendYield.toFixed(2).padEnd(12)}`);
    }
  } else {
    console.log('❌ 未获取到数据');
  }
  
  // 示例4: 批量获取所有高股息率股票（聚源）
  console.log('\n' + '='.repeat(70));
  console.log('【示例4】批量获取所有高股息率股票（聚源数据）');
  console.log('-'.repeat(70));
  
  const allDividendData = await getDividendYieldFromJuyuan(null, 100);
  
  if (allDividendData.size > 0) {
    // 按股息率排序
    const sortedData = Array.from(allDividendData.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // 只显示前10
    
    console.log(`\n共获取 ${allDividendData.size} 只股票，显示前10只：`);
    console.log(`\n${'排名'.padEnd(6)}${'股票名称'.padEnd(15)}${'股息率(%)'.padEnd(12)}`);
    console.log('-'.repeat(70));
    sortedData.forEach(([name, dividendYield], i) => {
      console.log(
        `${String(i + 1).padEnd(6)}${name.padEnd(15)}${dividendYield.toFixed(2).padEnd(12)}`
      );
    });
  } else {
    console.log('❌ 未获取到数据');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('示例运行完成！');
  console.log('='.repeat(70) + '\n');
}

// 导出函数
module.exports = {
  getDividendYieldFromJuyuan,
  getDividendYieldFromEastMoney,
  getTopDividendStocks,
  getDividendYieldForStocks,
};

// 如果直接运行此文件，执行示例
if (require.main === module) {
  demoUsage().catch(console.error);
}

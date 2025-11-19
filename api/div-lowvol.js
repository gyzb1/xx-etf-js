'use strict';

const { createJuyuanClientFromEnv } = require('../lib/juyuanClient');

async function getLargeCapStocks(client, percentile = 0.3) {
  const limit = Math.floor(5000 * percentile);
  const query = `A股市场总市值最高的前${limit}只股票`;
  const result = await client.nlQuery({ query, answerType: 2, limit });
  if (!result || !result.data) return [];

  const stocks = [];
  for (const group of result.data) {
    if (!group.valueInfo) continue;
    for (const item of group.valueInfo) {
      const name = item.secuAbbr || '';
      if (name) stocks.push(name);
    }
  }
  return stocks;
}

async function getProfitableStocks2024(client, stockNames) {
  const queries = [
    'A股2024年扣非净利润大于0的公司',
    'A股2024年扣非净利润最高的公司',
    'A股2024年盈利能力最强的公司',
  ];

  const allProfitable = new Set();

  for (const q of queries) {
    const result = await client.nlQuery({ query: q, answerType: 2, limit: 1000 });
    if (!result || !result.data) continue;

    for (const group of result.data) {
      if (!group.valueInfo) continue;
      for (const item of group.valueInfo) {
        const name = item.secuAbbr || '';
        const np = item.npoc_deducted ?? item.npoc_deducted_ttm ?? 0;
        if (!name) continue;
        const value = Number(np);
        if (!Number.isNaN(value) && value > 0) {
          allProfitable.add(name);
        }
      }
    }
  }

  const poolSet = new Set(stockNames);
  const filtered = Array.from(allProfitable).filter((n) => poolSet.has(n));

  if (filtered.length < 100) {
    return stockNames;
  }
  return filtered;
}

async function getHighDividendStocks(client, stockPool, topN = 50) {
  const poolSize = stockPool.length;
  if (!poolSize) return [];

  const query = `A股市场滚动股息率TTM最高的前${poolSize}只股票`;
  const result = await client.nlQuery({ query, answerType: 2, limit: Math.min(poolSize, 1000) });
  if (!result || !result.data) return [];

  const poolSet = new Set(stockPool);
  const stocks = [];

  for (const group of result.data) {
    if (!group.valueInfo) continue;

    const indicatorName = group.indicatorEngName || '';
    if (!indicatorName || !indicatorName.toLowerCase().includes('dividend')) continue;

    for (const item of group.valueInfo) {
      const name = item.secuAbbr || '';
      if (!name || !poolSet.has(name)) continue;
      const dy = Number(item.dividend_ratio_ttm ?? item.dividend_yield ?? 0);
      if (Number.isNaN(dy) || dy <= 0) continue;

      stocks.push({
        code: name,
        name,
        dividend_yield: dy,
      });
    }
  }

  stocks.sort((a, b) => b.dividend_yield - a.dividend_yield);
  return stocks.slice(0, topN);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    const client = createJuyuanClientFromEnv();

    const topN = Number(req.query.topN || 50) || 50;
    const percentile = Number(req.query.percentile || 0.3) || 0.3;

    const largeCap = await getLargeCapStocks(client, percentile);
    if (!largeCap.length) {
      throw new Error('无法获取大市值股票');
    }

    const profitable = await getProfitableStocks2024(client, largeCap);
    if (!profitable.length) {
      throw new Error('无法筛选盈利股票');
    }

    const highDividend = await getHighDividendStocks(client, profitable, topN);
    if (!highDividend.length) {
      throw new Error('无法获取高股息率股票');
    }

    const weight = 100 / highDividend.length;
    let totalDividendYield = 0;

    const stocks = highDividend.map((s) => {
      totalDividendYield += s.dividend_yield;
      return {
        ...s,
        weight: Number(weight.toFixed(2)),
      };
    });

    const avgDividendYield = totalDividendYield / highDividend.length;

    const portfolioId = `DIV_V2_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 15)}`;

    const portfolio = {
      portfolio_id: portfolioId,
      creation_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      strategy_version: 'v2',
      stock_count: stocks.length,
      stock_pool_size: profitable.length,
      selection_criteria: {
        market_cap: `前${Math.round(percentile * 100)}%`,
        profitability: '2024年盈利（扣非净利润>0）',
        dividend: `股息率最高前${topN}只`,
      },
      avg_dividend_yield: Number(avgDividendYield.toFixed(2)),
      weight_method: 'equal',
      stocks,
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(portfolio));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
  }
};

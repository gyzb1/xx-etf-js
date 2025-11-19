import { NextRequest, NextResponse } from 'next/server'

interface StockData {
  code: string
  name: string
  market_cap: number
  dividend_yield: number
  close: number
}

// 聚源 API 客户端
interface JuyuanClient {
  nlQuery: (params: { query: string; answerType: number; limit: number }) => Promise<any>
}

class JuyuanAIDBClient implements JuyuanClient {
  private appKey: string
  private appSecret: string
  private baseUrl: string
  private authUrl: string
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(appKey: string, appSecret: string, env: string = 'prd') {
    this.appKey = appKey
    this.appSecret = appSecret
    
    if (env === 'sandbox') {
      this.baseUrl = 'https://sandbox.hs.net/gildatacustomization/v1'
      this.authUrl = 'https://sandbox.hscloud.cn/oauth2/oauth2/token'
    } else {
      this.baseUrl = 'https://open.hs.net/gildatacustomization/v1'
      this.authUrl = 'https://open.hscloud.cn/oauth2/oauth2/token'
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now()
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken
    }

    const credentials = Buffer.from(`${this.appKey}:${this.appSecret}`).toString('base64')
    const res = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (!res.ok) {
      throw new Error(`聚源认证失败: ${res.status}`)
    }

    const data = await res.json()
    this.accessToken = data.access_token
    this.tokenExpiry = now + (data.expires_in - 300) * 1000
    return this.accessToken!
  }

  async nlQuery(params: { query: string; answerType: number; limit: number }): Promise<any> {
    const token = await this.getAccessToken()
    const url = `${this.baseUrl}/nl_query`
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: params.query,
        answerType: params.answerType,
        limit: Math.min(params.limit, 10000),
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`聚源 nl_query 失败: ${res.status} - ${errorText}`)
    }

    return await res.json()
  }
}

function createJuyuanClientFromEnv(): JuyuanClient {
  const appKey = process.env.JUYUAN_APP_KEY
  const appSecret = process.env.JUYUAN_APP_SECRET
  const env = process.env.JUYUAN_ENV || 'prd'

  if (!appKey || !appSecret) {
    throw new Error('缺少聚源 API 配置：JUYUAN_APP_KEY 或 JUYUAN_APP_SECRET')
  }

  return new JuyuanAIDBClient(appKey, appSecret, env)
}

// 东财 API - 获取 A 股市值数据
async function getStocksWithMarketCap(): Promise<Array<{ code: string; name: string; market_cap: number }>> {
  try {
    // f12=代码, f14=名称, f20=总市值(亿)
    const url = 'http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5000&po=1&np=1&fltt=2&invt=2&fid=f20&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14,f20'
    
    console.log('[东财] 获取 A 股市值数据...')
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    
    if (!res.ok) {
      throw new Error(`东财 API 请求失败: ${res.status}`)
    }

    const data = await res.json()
    if (!data.data || !data.data.diff) {
      console.error('[东财] 返回数据:', JSON.stringify(data).slice(0, 200))
      throw new Error('东财 API 返回数据格式错误')
    }

    const stocks = data.data.diff
      .filter((item: any) => item.f20 && item.f12)
      .map((item: any) => ({
        code: item.f12,
        name: item.f14,
        market_cap: item.f20,
      }))

    console.log(`[东财] 获取到 ${stocks.length} 只股票市值数据`)
    return stocks
  } catch (error: any) {
    console.error('[东财] 获取市值数据失败:', error.message)
    throw error
  }
}

// 聚源 API - 获取股息率数据
async function getDividendYieldFromJuyuan(client: JuyuanClient, stockNames: string[]): Promise<Map<string, number>> {
  const dividendMap = new Map<string, number>()
  
  // 批量查询股息率
  const query = `A股市场滚动股息率TTM最高的前${Math.min(stockNames.length, 1000)}只股票`
  console.log(`[聚源] 查询股息率: ${query}`)
  
  const result = await client.nlQuery({ query, answerType: 2, limit: Math.min(stockNames.length, 1000) })
  if (!result || !result.data) {
    console.warn('[聚源] 股息率查询返回空数据')
    return dividendMap
  }

  const nameSet = new Set(stockNames)
  
  for (const group of result.data) {
    if (!group.valueInfo) continue
    
    const indicatorName = group.indicatorEngName || ''
    if (!indicatorName.toLowerCase().includes('dividend')) continue

    for (const item of group.valueInfo) {
      const name = item.secuAbbr || ''
      if (!name || !nameSet.has(name)) continue
      
      const dy = Number(item.dividend_ratio_ttm ?? item.dividend_yield ?? 0)
      if (!isNaN(dy) && dy > 0) {
        dividendMap.set(name, dy)
      }
    }
  }

  console.log(`[聚源] 获取到 ${dividendMap.size} 只股票的股息率数据`)
  return dividendMap
}

export async function GET(request: NextRequest) {
  try {
    console.log('[div-lowvol] 开始处理请求')
    
    const { searchParams } = new URL(request.url)
    const topN = Number(searchParams.get('topN') || 50) || 50
    const percentile = Number(searchParams.get('percentile') || 0.3) || 0.3
    let useJuyuan = searchParams.get('juyuan') === 'true'
    
    console.log(`[div-lowvol] 参数: topN=${topN}, percentile=${percentile}, useJuyuan=${useJuyuan}`)
    
    // 1. 用东财获取市值数据并筛选
    const allStocks = await getStocksWithMarketCap()
    if (!allStocks.length) {
      throw new Error('无法获取股票数据')
    }

    // 2. 按市值排序，筛选前 N%
    const sortedByMarketCap = [...allStocks].sort((a, b) => b.market_cap - a.market_cap)
    const marketCapThreshold = Math.floor(sortedByMarketCap.length * percentile)
    const largeCapStocks = sortedByMarketCap.slice(0, marketCapThreshold)
    console.log(`[div-lowvol] 筛选出市值前${Math.round(percentile * 100)}%: ${largeCapStocks.length} 只股票`)

    let stocksWithDividend: StockData[] = []
    let dataSource = '东财'
    
    if (useJuyuan) {
      // 3a. 尝试用聚源查询股息率
      try {
        const client = createJuyuanClientFromEnv()
        const stockNames = largeCapStocks.map(s => s.name)
        const dividendMap = await getDividendYieldFromJuyuan(client, stockNames)
        
        for (const stock of largeCapStocks) {
          const dividendYield = dividendMap.get(stock.name)
          if (dividendYield && dividendYield > 0) {
            stocksWithDividend.push({
              code: stock.code,
              name: stock.name,
              market_cap: stock.market_cap,
              close: 0,
              dividend_yield: dividendYield,
            })
          }
        }
        dataSource = '聚源'
        console.log(`[div-lowvol] 使用聚源数据，获取到 ${stocksWithDividend.length} 只有股息率的股票`)
      } catch (juyuanErr: any) {
        console.warn('[div-lowvol] 聚源查询失败，回退到东财数据:', juyuanErr.message)
        // 回退到东财
        useJuyuan = false
      }
    }
    
    if (!useJuyuan || stocksWithDividend.length === 0) {
      // 3b. 使用东财的股息率数据（f127字段）
      console.log('[div-lowvol] 使用东财股息率数据')
      const url = 'http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5000&po=1&np=1&fltt=2&invt=2&fid=f127&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14,f127'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`东财股息率API失败: ${res.status}`)
      
      const data = await res.json()
      const dividendMap = new Map<string, number>()
      
      if (data.data && data.data.diff) {
        for (const item of data.data.diff) {
          if (item.f12 && item.f127 && item.f127 > 0) {
            dividendMap.set(item.f12, item.f127)
          }
        }
      }
      
      console.log(`[东财] 获取到 ${dividendMap.size} 只股票的股息率`)
      
      for (const stock of largeCapStocks) {
        const dividendYield = dividendMap.get(stock.code)
        if (dividendYield && dividendYield > 0) {
          stocksWithDividend.push({
            code: stock.code,
            name: stock.name,
            market_cap: stock.market_cap,
            close: 0,
            dividend_yield: dividendYield,
          })
        }
      }
      dataSource = '东财'
    }
    
    console.log(`[div-lowvol] 合并后有股息率数据的股票: ${stocksWithDividend.length} 只`)

    // 4. 按股息率排序，选出前 topN 只
    const sortedByDividend = [...stocksWithDividend].sort((a, b) => b.dividend_yield - a.dividend_yield)
    const highDividendStocks = sortedByDividend.slice(0, topN)
    console.log(`[div-lowvol] 选出股息率最高的前${topN}只股票`)

    if (!highDividendStocks.length) {
      throw new Error('无法获取高股息率股票')
    }

    // 5. 等权重配置
    const weight = 100 / highDividendStocks.length
    let totalDividendYield = 0

    const stocks = highDividendStocks.map((s) => {
      totalDividendYield += s.dividend_yield
      return {
        code: s.code,
        name: s.name,
        dividend_yield: Number(s.dividend_yield.toFixed(2)),
        weight: Number(weight.toFixed(2)),
      }
    })

    const avgDividendYield = totalDividendYield / highDividendStocks.length

    const portfolioId = `DIV_V2_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 15)}`

    const portfolio = {
      portfolio_id: portfolioId,
      creation_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      strategy_version: 'v2-eastmoney',
      stock_count: stocks.length,
      stock_pool_size: largeCapStocks.length,
      selection_criteria: {
        market_cap: `前${Math.round(percentile * 100)}%（${largeCapStocks.length}只）`,
        profitability: '无盈利筛选',
        dividend: `股息率最高前${topN}只（${dataSource}数据）`,
      },
      avg_dividend_yield: Number(avgDividendYield.toFixed(2)),
      weight_method: 'equal',
      stocks,
    }

    console.log(`[div-lowvol] 组合构建完成，平均股息率: ${avgDividendYield.toFixed(2)}%`)
    return NextResponse.json(portfolio)
  } catch (err: any) {
    console.error('[div-lowvol] 错误:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

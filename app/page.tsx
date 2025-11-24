'use client'

import { useState, useEffect } from 'react'

interface Stock {
  code: string
  name: string
  dividend_yield: number
  weight: number
  daily_change?: number | null
  latest_price?: number | null
}

interface NavPoint {
  date: string
  nav: number
  return: number
}

interface Portfolio {
  portfolio_id: string
  creation_time: string
  update_time?: string
  strategy_version: string
  stock_count: number
  stock_pool_size?: number
  selection_criteria: {
    data_source?: string
    method?: string
    market_cap?: string
    profitability?: string
    dividend: string
  }
  avg_dividend_yield: number
  weight_method: string
  latest_nav?: number | null
  fund_daily_change?: number | null
  stocks: Stock[]
  nav_curve?: NavPoint[]
}

export default function Home() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPortfolio = async () => {
    setLoading(true)
    setError(null)
    try {
      // 使用聚源API端点
      const res = await fetch('/api/portfolio?topN=50')
      if (!res.ok) {
        // 尝试获取详细错误信息
        const errorData = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(`HTTP ${res.status}: ${errorData.error || res.statusText}`)
      }
      const data = await res.json()
      setPortfolio(data)
    } catch (err: any) {
      console.error('加载组合失败:', err)
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPortfolio()
  }, [])

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{ 
          marginBottom: '40px',
          textAlign: 'center',
          color: '#fff'
        }}>
          <h1 style={{ 
            fontSize: '42px', 
            fontWeight: 700, 
            marginBottom: '12px',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            🎯 高股息红利组合
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.9 }}>
            基于聚源AIDB的A股高股息率投资组合 · 扣非净利润为正 · 等权重配置
          </p>
        </header>

        {/* Action Button */}
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <button
            onClick={loadPortfolio}
            disabled={loading}
            style={{
              padding: '14px 32px',
              fontSize: '16px',
              fontWeight: 600,
              backgroundColor: loading ? '#999' : '#fff',
              color: loading ? '#fff' : '#667eea',
              border: 'none',
              borderRadius: '50px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
              transition: 'all 0.3s ease',
              transform: loading ? 'scale(0.98)' : 'scale(1)',
            }}
          >
            {loading ? '⏳ 加载中...' : '🔄 刷新组合'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#fff',
              color: '#e53e3e',
              borderRadius: '12px',
              marginBottom: '30px',
              fontSize: '15px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              border: '2px solid #feb2b2'
            }}
          >
            ❌ 错误: {error}
          </div>
        )}

        {portfolio && (
          <>
            {/* Stats Cards */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: '20px',
              marginBottom: '30px'
            }}>
              <div style={{
                padding: '24px',
                backgroundColor: '#fff',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>📅 更新时间</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#2d3748' }}>
                  {portfolio.update_time || portfolio.creation_time}
                </div>
              </div>
              
              {portfolio.latest_nav !== null && portfolio.latest_nav !== undefined && (
                <div style={{
                  padding: '24px',
                  backgroundColor: '#fff',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>💰 最新净值</div>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: '#2d3748' }}>
                    {portfolio.latest_nav.toFixed(4)}
                  </div>
                  {portfolio.fund_daily_change !== null && portfolio.fund_daily_change !== undefined && (
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: 600,
                      color: portfolio.fund_daily_change >= 0 ? '#48bb78' : '#f56565',
                      marginTop: '8px'
                    }}>
                      今日 {portfolio.fund_daily_change >= 0 ? '+' : ''}{portfolio.fund_daily_change.toFixed(2)}%
                    </div>
                  )}
                </div>
              )}
              
              <div style={{
                padding: '24px',
                backgroundColor: '#fff',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>📊 持仓数量</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#667eea' }}>
                  {portfolio.stock_count}
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>只股票</div>
              </div>
              
              <div style={{
                padding: '24px',
                backgroundColor: '#fff',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>💰 平均股息率</div>
                <div style={{ fontSize: '36px', fontWeight: 700, color: '#48bb78' }}>
                  {portfolio.avg_dividend_yield.toFixed(2)}%
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>年化收益</div>
              </div>
            </div>

            {/* Selection Criteria */}
            <div style={{
              padding: '24px',
              backgroundColor: '#fff',
              borderRadius: '16px',
              marginBottom: '30px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: 600, 
                marginBottom: '16px',
                color: '#2d3748',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                ⚙️ 选股标准
              </h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                {portfolio.selection_criteria.data_source && (
                  <div style={{ 
                    padding: '12px 16px',
                    backgroundColor: '#f7fafc',
                    borderRadius: '8px',
                    borderLeft: '4px solid #667eea'
                  }}>
                    <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>数据源</div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#2d3748' }}>
                      {portfolio.selection_criteria.data_source}
                    </div>
                  </div>
                )}
                {portfolio.selection_criteria.profitability && (
                  <div style={{ 
                    padding: '12px 16px',
                    backgroundColor: '#f7fafc',
                    borderRadius: '8px',
                    borderLeft: '4px solid #48bb78'
                  }}>
                    <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>盈利能力</div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#2d3748' }}>
                      {portfolio.selection_criteria.profitability}
                    </div>
                  </div>
                )}
                <div style={{ 
                  padding: '12px 16px',
                  backgroundColor: '#f7fafc',
                  borderRadius: '8px',
                  borderLeft: '4px solid #ed8936'
                }}>
                  <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>股息筛选</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#2d3748' }}>
                    {portfolio.selection_criteria.dividend}
                  </div>
                </div>
                <div style={{ 
                  padding: '12px 16px',
                  backgroundColor: '#f7fafc',
                  borderRadius: '8px',
                  borderLeft: '4px solid #9f7aea'
                }}>
                  <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>权重方式</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#2d3748' }}>
                    等权重 ({(100 / portfolio.stock_count).toFixed(2)}%)
                  </div>
                </div>
              </div>
            </div>

            {/* Nav Curve Chart */}
            {portfolio.nav_curve && portfolio.nav_curve.length > 0 && (
              <div style={{
                backgroundColor: '#fff',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '30px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}>
                <h2 style={{ 
                  fontSize: '20px', 
                  fontWeight: 600, 
                  marginBottom: '20px',
                  color: '#2d3748',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📊 净值曲线（最近30天）
                </h2>
                <div style={{ position: 'relative', height: '350px' }}>
                  <svg width="100%" height="100%" viewBox="0 0 800 350" preserveAspectRatio="xMidYMid meet">
                    {/* 计算坐标 */}
                    {(() => {
                      const navs = portfolio.nav_curve!.map(p => p.nav);
                      const minNav = Math.min(...navs, 1.0);
                      const maxNav = Math.max(...navs, 1.0);
                      const range = maxNav - minNav || 0.1;
                      const padding = range * 0.1;
                      
                      const yMin = minNav - padding;
                      const yMax = maxNav + padding;
                      const yRange = yMax - yMin;
                      
                      // 计算基准线 1.0 的 Y 坐标
                      const baselineY = 270 - ((1.0 - yMin) / yRange) * 220;
                      
                      const points = portfolio.nav_curve!.map((point, i) => {
                        const x = 60 + (i / (portfolio.nav_curve!.length - 1)) * 680;
                        const y = 270 - ((point.nav - yMin) / yRange) * 220;
                        return `${x},${y}`;
                      }).join(' ');
                      
                      const lastPoint = portfolio.nav_curve![portfolio.nav_curve!.length - 1];
                      const totalReturn = lastPoint.return;
                      const lineColor = totalReturn >= 0 ? '#48bb78' : '#f56565';
                      
                      // 选择要显示的日期标签（每隔几天显示一个）
                      const dateInterval = Math.ceil(portfolio.nav_curve!.length / 6);
                      const dateLabels = portfolio.nav_curve!.filter((_, i) => i % dateInterval === 0 || i === portfolio.nav_curve!.length - 1);
                      
                      return (
                        <>
                          {/* 背景网格 */}
                          <line x1="60" y1="270" x2="740" y2="270" stroke="#e2e8f0" strokeWidth="1" />
                          <line x1="60" y1="220" x2="740" y2="220" stroke="#e2e8f0" strokeWidth="1" />
                          <line x1="60" y1="170" x2="740" y2="170" stroke="#e2e8f0" strokeWidth="1" />
                          <line x1="60" y1="120" x2="740" y2="120" stroke="#e2e8f0" strokeWidth="1" />
                          <line x1="60" y1="70" x2="740" y2="70" stroke="#e2e8f0" strokeWidth="1" />
                          
                          {/* 基准线 1.0 */}
                          <line x1="60" y1={baselineY} x2="740" y2={baselineY} stroke="#cbd5e0" strokeWidth="2" strokeDasharray="5,5" />
                          <text x="45" y={baselineY + 4} fontSize="11" fill="#718096" textAnchor="end" fontWeight="600">1.00</text>
                          
                          {/* 净值曲线 */}
                          <polyline
                            points={points}
                            fill="none"
                            stroke={lineColor}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          
                          {/* Y轴标签 */}
                          <text x="45" y="275" fontSize="11" fill="#666" textAnchor="end">{yMin.toFixed(3)}</text>
                          <text x="45" y="75" fontSize="11" fill="#666" textAnchor="end">{yMax.toFixed(3)}</text>
                          
                          {/* X轴日期标签 */}
                          {dateLabels.map((point, idx) => {
                            const originalIndex = portfolio.nav_curve!.indexOf(point);
                            const x = 60 + (originalIndex / (portfolio.nav_curve!.length - 1)) * 680;
                            const dateStr = point.date.slice(5); // 只显示 MM-DD
                            return (
                              <text key={idx} x={x} y="295" fontSize="10" fill="#666" textAnchor="middle">
                                {dateStr}
                              </text>
                            );
                          })}
                          
                          {/* 收益率标签 */}
                          <text x="400" y="30" fontSize="16" fill={lineColor} textAnchor="middle" fontWeight="600">
                            累计收益: {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
                          </text>
                          
                          {/* 最新净值标签 */}
                          <text x="400" y="50" fontSize="13" fill="#666" textAnchor="middle">
                            最新净值: {lastPoint.nav.toFixed(4)}
                          </text>
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            )}

            {/* Holdings Table */}
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: 600, 
                marginBottom: '20px',
                color: '#2d3748',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                📈 持仓明细
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  fontSize: '14px',
                }}>
                  <thead>
                    <tr>
                      <th style={{ 
                        padding: '14px 12px', 
                        textAlign: 'left', 
                        backgroundColor: '#f7fafc',
                        color: '#4a5568',
                        fontWeight: 600,
                        fontSize: '13px',
                        borderBottom: '2px solid #e2e8f0',
                        borderTopLeftRadius: '8px'
                      }}>排名</th>
                      <th style={{ 
                        padding: '14px 12px', 
                        textAlign: 'left', 
                        backgroundColor: '#f7fafc',
                        color: '#4a5568',
                        fontWeight: 600,
                        fontSize: '13px',
                        borderBottom: '2px solid #e2e8f0'
                      }}>股票名称</th>
                      <th style={{ 
                        padding: '14px 12px', 
                        textAlign: 'left', 
                        backgroundColor: '#f7fafc',
                        color: '#4a5568',
                        fontWeight: 600,
                        fontSize: '13px',
                        borderBottom: '2px solid #e2e8f0'
                      }}>代码</th>
                      <th style={{ 
                        padding: '14px 12px', 
                        textAlign: 'right', 
                        backgroundColor: '#f7fafc',
                        color: '#4a5568',
                        fontWeight: 600,
                        fontSize: '13px',
                        borderBottom: '2px solid #e2e8f0'
                      }}>股息率</th>
                      <th style={{ 
                        padding: '14px 12px', 
                        textAlign: 'right', 
                        backgroundColor: '#f7fafc',
                        color: '#4a5568',
                        fontWeight: 600,
                        fontSize: '13px',
                        borderBottom: '2px solid #e2e8f0',
                        borderTopRightRadius: '8px'
                      }}>权重</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.stocks.map((stock, idx) => (
                      <tr 
                        key={idx} 
                        style={{ 
                          borderBottom: '1px solid #f0f0f0',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f7fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ 
                          padding: '14px 12px',
                          fontWeight: 600,
                          color: idx < 3 ? '#667eea' : '#718096'
                        }}>
                          {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `${idx + 1}`}
                        </td>
                        <td style={{ padding: '14px 12px', fontWeight: 500, color: '#2d3748' }}>
                          {stock.name}
                        </td>
                        <td style={{ 
                          padding: '14px 12px', 
                          fontFamily: 'monospace',
                          color: '#718096',
                          fontSize: '13px'
                        }}>
                          {stock.code}
                        </td>
                        <td style={{ 
                          padding: '14px 12px', 
                          textAlign: 'right',
                          fontWeight: 600,
                          color: '#48bb78',
                          fontSize: '15px'
                        }}>
                          {stock.dividend_yield.toFixed(2)}%
                        </td>
                        <td style={{ 
                          padding: '14px 12px', 
                          textAlign: 'right',
                          color: '#718096'
                        }}>
                          {stock.weight.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              marginTop: '30px',
              textAlign: 'center',
              color: '#fff',
              opacity: 0.8,
              fontSize: '13px'
            }}>
              <p>数据来源: 聚源AIDB · 仅供参考，不构成投资建议</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

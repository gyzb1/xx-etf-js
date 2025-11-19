// 测试新的API端点
async function testAPI() {
  console.log('测试 /api/portfolio 端点...\n');
  
  try {
    const url = 'http://localhost:3000/api/portfolio?topN=20';
    console.log('请求URL:', url);
    console.log('开始请求...\n');
    
    const startTime = Date.now();
    const res = await fetch(url);
    const duration = Date.now() - startTime;
    
    console.log(`响应状态: ${res.status} ${res.statusText}`);
    console.log(`响应时间: ${duration}ms\n`);
    
    if (!res.ok) {
      const error = await res.json();
      console.error('错误:', error);
      return;
    }
    
    const data = await res.json();
    
    console.log('组合信息:');
    console.log('- 组合ID:', data.portfolio_id);
    console.log('- 创建时间:', data.creation_time);
    console.log('- 股票数量:', data.stock_count);
    console.log('- 平均股息率:', data.avg_dividend_yield + '%');
    console.log('\n选股标准:');
    console.log('- 数据源:', data.selection_criteria.data_source);
    console.log('- 盈利能力:', data.selection_criteria.profitability);
    console.log('- 股息筛选:', data.selection_criteria.dividend);
    
    console.log('\n前10只股票:');
    data.stocks.slice(0, 10).forEach((stock, i) => {
      console.log(`${i + 1}. ${stock.name} (${stock.code}) - 股息率: ${stock.dividend_yield}% - 权重: ${stock.weight}%`);
    });
    
    console.log('\n✅ API测试成功！');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

testAPI();

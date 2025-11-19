// 测试东财API是否可以访问
const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)));

async function testEastMoneyAPI() {
  console.log('测试东财API...\n');
  
  try {
    const url = 'http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10&po=1&np=1&fltt=2&invt=2&fid=f20&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14,f20';
    
    console.log('请求URL:', url);
    console.log('开始请求...\n');
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    console.log('响应状态:', res.status, res.statusText);
    console.log('响应头:', Object.fromEntries(res.headers.entries()));
    
    const data = await res.json();
    console.log('\n响应数据结构:');
    console.log('- data存在:', !!data.data);
    console.log('- data.diff存在:', !!data.data?.diff);
    console.log('- 股票数量:', data.data?.diff?.length || 0);
    
    if (data.data?.diff?.length > 0) {
      console.log('\n前3只股票示例:');
      data.data.diff.slice(0, 3).forEach((item, i) => {
        console.log(`${i + 1}. ${item.f14} (${item.f12}) - 市值: ${item.f20}亿`);
      });
      console.log('\n✅ 东财API测试成功！');
    } else {
      console.log('\n❌ 返回数据为空');
      console.log('完整响应:', JSON.stringify(data, null, 2).slice(0, 500));
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

testEastMoneyAPI();

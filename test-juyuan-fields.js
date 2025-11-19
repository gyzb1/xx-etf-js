// 测试聚源API返回的字段
const { JuyuanAIDBClient } = require('./lib/juyuanClient');

async function testJuyuanFields() {
  try {
    console.log('测试聚源API返回的字段结构...\n');
    
    const client = new JuyuanAIDBClient({
      appKey: 'cde5588c-25b7-408b-95bf-56768e817ab0',
      appSecret: '3544d3a4-224d-4f1b-ad7b-0c14e842b51b',
      env: 'prd'
    });
    
    // 查询高股息率股票
    const query = `A股市场滚动股息率TTM最高的前10只股票的股票代码、股票名称和股息率`;
    console.log(`查询: ${query}\n`);
    
    const result = await client.nlQuery({
      query,
      answerType: 2,
      limit: 10
    });
    
    if (!result || !result.data) {
      console.error('❌ 返回空数据');
      return;
    }
    
    console.log(`✅ 返回了 ${result.data.length} 个数据组\n`);
    
    // 遍历每个数据组
    for (let i = 0; i < result.data.length; i++) {
      const group = result.data[i];
      console.log(`\n📊 数据组 ${i + 1}:`);
      console.log(`  指标名称: ${group.indicatorName || '未知'}`);
      console.log(`  指标英文名: ${group.indicatorEngName || '未知'}`);
      
      if (!group.valueInfo || group.valueInfo.length === 0) {
        console.log('  ⚠️  无valueInfo数据');
        continue;
      }
      
      console.log(`  数据条数: ${group.valueInfo.length}`);
      
      // 显示前3条数据的所有字段
      const sampleCount = Math.min(3, group.valueInfo.length);
      for (let j = 0; j < sampleCount; j++) {
        const item = group.valueInfo[j];
        console.log(`\n  📝 样本 ${j + 1} 的所有字段:`);
        
        // 列出所有字段和值
        const fields = Object.keys(item);
        fields.forEach(field => {
          const value = item[field];
          const type = typeof value;
          const displayValue = type === 'string' || type === 'number' 
            ? value 
            : JSON.stringify(value).slice(0, 50);
          console.log(`    - ${field}: ${displayValue} (${type})`);
        });
      }
    }
    
    console.log('\n\n🔍 总结：');
    console.log('请查看上面的字段列表，找到包含股票代码的字段名');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  }
}

testJuyuanFields();

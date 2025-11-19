// 测试环境变量是否正确加载
require('dotenv').config({ path: '.env.local' });

console.log('环境变量测试:');
console.log('JUYUAN_APP_KEY:', process.env.JUYUAN_APP_KEY ? '已设置 (' + process.env.JUYUAN_APP_KEY.slice(0, 10) + '...)' : '未设置');
console.log('JUYUAN_APP_SECRET:', process.env.JUYUAN_APP_SECRET ? '已设置 (' + process.env.JUYUAN_APP_SECRET.slice(0, 10) + '...)' : '未设置');
console.log('JUYUAN_ENV:', process.env.JUYUAN_ENV || '未设置');

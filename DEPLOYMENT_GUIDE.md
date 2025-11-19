# 🚀 Vercel 部署指南

本项目是基于 **xx-etf** Python项目改造的Next.js版本，使用聚源AIDB获取A股高股息率数据。

## ✅ 已完成的工作

1. ✅ 将Python的聚源API调用逻辑移植到Node.js
2. ✅ 创建Next.js API路由 `/api/portfolio`
3. ✅ 实现与Python版本完全相同的数据获取逻辑
4. ✅ 本地测试成功，可正常获取股息率数据
5. ✅ 适配Vercel Serverless Functions

## 📋 项目结构

```
xx-etf-js/
├── app/
│   ├── api/
│   │   └── portfolio/
│   │       └── route.js          # 聚源API路由（核心）
│   └── page.tsx                   # 前端页面
├── .env.local                     # 环境变量（本地）
├── next.config.js
└── package.json
```

## 🔑 环境变量配置

### 本地开发 (`.env.local`)

```env
JUYUAN_APP_KEY=cde5588c-25b7-408b-95bf-56768e817ab0
JUYUAN_APP_SECRET=3544d3a4-224d-4f1b-ad7b-0c14e842b51b
JUYUAN_ENV=prd
```

### Vercel部署

在Vercel项目设置中添加环境变量：

1. 进入项目 → Settings → Environment Variables
2. 添加以下变量：
   - `JUYUAN_APP_KEY` = `cde5588c-25b7-408b-95bf-56768e817ab0`
   - `JUYUAN_APP_SECRET` = `3544d3a4-224d-4f1b-ad7b-0c14e842b51b`
   - `JUYUAN_ENV` = `prd`

## 🌐 Vercel 部署步骤

### 方法1: 通过Vercel Dashboard（推荐）

1. **推送代码到GitHub**
   ```bash
   git add .
   git commit -m "Add Juyuan AIDB integration"
   git push origin main
   ```

2. **导入到Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 点击 "New Project"
   - 选择你的GitHub仓库
   - Framework Preset: **Next.js** (自动检测)

3. **配置环境变量**
   - 在部署前，点击 "Environment Variables"
   - 添加上述3个环境变量
   - 选择 "Production", "Preview", "Development" 全部勾选

4. **部署**
   - 点击 "Deploy"
   - 等待构建完成（约2-3分钟）

### 方法2: 通过Vercel CLI

```bash
# 安装Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 添加环境变量
vercel env add JUYUAN_APP_KEY
vercel env add JUYUAN_APP_SECRET
vercel env add JUYUAN_ENV

# 重新部署
vercel --prod
```

## 📊 API端点

### `/api/portfolio`

获取高股息率股票组合

**参数：**
- `topN` (可选): 返回前N只股票，默认50

**示例：**
```
GET https://your-domain.vercel.app/api/portfolio?topN=50
```

**响应：**
```json
{
  "portfolio_id": "DIV_JUYUAN_20251119112800",
  "creation_time": "2025-11-19 11:28:00",
  "strategy_version": "v2-juyuan",
  "stock_count": 50,
  "selection_criteria": {
    "data_source": "聚源AIDB",
    "method": "自然语言查询",
    "dividend": "股息率TTM最高前50只"
  },
  "avg_dividend_yield": 10.25,
  "weight_method": "equal",
  "stocks": [
    {
      "code": "东方雨虹",
      "name": "东方雨虹",
      "dividend_yield": 14.58,
      "weight": 2.00
    },
    ...
  ]
}
```

## 🔍 数据获取逻辑

完全参照 **xx-etf** Python项目：

1. **认证**: OAuth2.0 获取access_token
2. **查询**: 使用自然语言查询聚源AIDB
   - 查询语句: `"A股市场滚动股息率TTM最高的前100只股票"`
3. **解析**: 从返回的`data.valueInfo`中提取股息率数据
4. **排序**: 按股息率降序排列
5. **构建**: 等权重配置，每只股票2%

## ⚙️ Vercel配置

### `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel会自动处理，无需特殊配置
}

module.exports = nextConfig
```

### Serverless Function 配置

API路由会自动部署为Serverless Functions，默认配置：
- **超时**: 10秒（Hobby计划）/ 60秒（Pro计划）
- **内存**: 1024MB
- **区域**: 自动选择最近的

如需调整，在API路由文件中添加：

```javascript
export const config = {
  maxDuration: 60, // Pro计划可用
}
```

## 🐛 常见问题

### 1. 部署后500错误

**原因**: 环境变量未配置

**解决**: 
- 检查Vercel项目设置中的环境变量
- 确保变量名完全匹配（区分大小写）
- 重新部署项目

### 2. API超时

**原因**: 聚源API响应较慢（10-15秒）

**解决**:
- Hobby计划: 减少`topN`参数（如改为30）
- Pro计划: 增加`maxDuration`配置
- 添加缓存机制

### 3. 403认证失败

**原因**: API密钥错误或过期

**解决**:
- 检查`.env.local`中的密钥是否正确
- 确认密钥在恒生开放平台是否有效
- 检查是否订阅了"聚源AIDB金融数据查询服务"

### 4. 数据为空

**原因**: 查询语句不匹配或数据解析错误

**解决**:
- 查看Vercel日志: `vercel logs`
- 检查聚源API返回的数据结构
- 调整数据解析逻辑

## 📈 性能优化

### 1. 添加缓存

```javascript
// 缓存1小时
export const revalidate = 3600;

export async function GET(request) {
  // ... API逻辑
}
```

### 2. 使用Edge Runtime

```javascript
export const runtime = 'edge';

export async function GET(request) {
  // ... API逻辑
}
```

### 3. 数据预取

在构建时预取数据：

```javascript
// app/page.tsx
export async function generateStaticParams() {
  // 预取数据
}
```

## 📝 与Python版本对比

| 特性 | Python (xx-etf) | Node.js (xx-etf-js) |
|------|----------------|---------------------|
| **框架** | Flask | Next.js 14 |
| **部署** | 本地/服务器 | Vercel Serverless |
| **数据源** | 聚源AIDB | 聚源AIDB |
| **查询方式** | 自然语言 | 自然语言 |
| **响应时间** | 10-15秒 | 10-15秒 |
| **扩展性** | 需要服务器 | 自动扩展 |
| **成本** | 服务器费用 | 免费（Hobby） |

## 🎯 下一步优化

- [ ] 添加Redis缓存减少API调用
- [ ] 实现增量更新机制
- [ ] 添加数据可视化图表
- [ ] 支持自定义筛选条件
- [ ] 添加历史数据对比
- [ ] 实现邮件/推送通知

## 📞 技术支持

- **聚源AIDB文档**: https://www.hs.net/openplat-doc/
- **Next.js文档**: https://nextjs.org/docs
- **Vercel文档**: https://vercel.com/docs

## 📄 许可证

本项目仅供学习和研究使用。

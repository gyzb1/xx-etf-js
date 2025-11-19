# 🚀 Vercel 部署完整指南

## ✅ 项目已准备就绪

你的项目已经完全配置好，可以直接部署到Vercel！

## 📋 部署前检查清单

- ✅ Next.js 14 项目结构
- ✅ API路由已创建 (`/api/portfolio`)
- ✅ 前端界面已美化
- ✅ 聚源AIDB集成完成
- ✅ 扣非净利润筛选已实现
- ✅ 本地测试通过

## 🔧 推送到GitHub

### 方法1: 命令行（如果网络正常）

```bash
# 已完成的步骤
git init
git add .
git commit -m "Initial commit: 高股息红利组合系统 - 基于聚源AIDB"
git remote add origin https://github.com/gyzb1/xx-etf-js.git
git branch -M main

# 需要执行的步骤
git push -u origin main
```

### 方法2: GitHub Desktop（推荐）

1. 打开 GitHub Desktop
2. File → Add Local Repository
3. 选择 `C:\Users\leesi\CascadeProjects\xx-etf-js`
4. Publish repository
5. 选择账号 gyzb1
6. Repository name: xx-etf-js
7. 点击 Publish

### 方法3: 手动上传

1. 访问 https://github.com/new
2. Repository name: `xx-etf-js`
3. 创建仓库
4. 使用 "uploading an existing file" 上传所有文件

## 🌐 部署到Vercel

### 步骤1: 导入项目

1. 访问 https://vercel.com
2. 点击 "Add New..." → "Project"
3. 选择 "Import Git Repository"
4. 选择 `gyzb1/xx-etf-js`
5. 点击 "Import"

### 步骤2: 配置项目

**Framework Preset**: Next.js (自动检测)

**Root Directory**: `./` (默认)

**Build Command**: `npm run build` (默认)

**Output Directory**: `.next` (默认)

### 步骤3: 配置环境变量 ⚠️ 重要！

在 "Environment Variables" 部分添加：

| Name | Value |
|------|-------|
| `JUYUAN_APP_KEY` | `cde5588c-25b7-408b-95bf-56768e817ab0` |
| `JUYUAN_APP_SECRET` | `3544d3a4-224d-4f1b-ad7b-0c14e842b51b` |
| `JUYUAN_ENV` | `prd` |

**环境选择**: 全部勾选 (Production, Preview, Development)

### 步骤4: 部署

1. 点击 "Deploy"
2. 等待构建完成（约2-3分钟）
3. 部署成功后会显示项目URL

## 🎯 部署后的URL

你的项目将部署到类似这样的地址：
- `https://xx-etf-js.vercel.app`
- 或自定义域名

## 📊 API端点

部署后可以访问：

- **主页**: `https://your-domain.vercel.app/`
- **API**: `https://your-domain.vercel.app/api/portfolio?topN=50`

## 🔍 验证部署

### 1. 检查主页

访问主页，应该能看到：
- 🎯 高股息红利组合标题
- 紫色渐变背景
- 三个统计卡片
- 选股标准
- 持仓明细表格

### 2. 测试API

```bash
curl https://your-domain.vercel.app/api/portfolio?topN=20
```

应该返回JSON格式的组合数据。

### 3. 检查日志

在Vercel Dashboard中：
1. 进入项目
2. 点击 "Deployments"
3. 点击最新的部署
4. 查看 "Functions" 日志

## ⚙️ Vercel配置文件（可选）

如果需要自定义配置，创建 `vercel.json`：

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "JUYUAN_APP_KEY": "@juyuan-app-key",
    "JUYUAN_APP_SECRET": "@juyuan-app-secret",
    "JUYUAN_ENV": "prd"
  },
  "functions": {
    "app/api/portfolio/route.js": {
      "maxDuration": 60
    }
  }
}
```

## 🐛 常见问题

### 1. 部署成功但页面空白

**原因**: 环境变量未配置

**解决**:
1. 进入 Vercel 项目设置
2. Settings → Environment Variables
3. 添加三个环境变量
4. 重新部署

### 2. API返回500错误

**原因**: 聚源API调用失败

**解决**:
1. 检查环境变量是否正确
2. 查看 Functions 日志
3. 确认API密钥有效

### 3. API超时

**原因**: Hobby计划限制10秒

**解决**:
- 减少 `topN` 参数（如改为30）
- 升级到Pro计划（60秒超时）

### 4. 推送GitHub失败

**原因**: 网络连接问题

**解决**:
- 使用 GitHub Desktop
- 或使用VPN
- 或手动上传文件

## 📈 性能优化建议

### 1. 添加缓存

在 `app/api/portfolio/route.js` 顶部添加：

```javascript
export const revalidate = 3600; // 缓存1小时
```

### 2. 使用Edge Runtime（可选）

```javascript
export const runtime = 'edge';
```

### 3. 压缩响应

Vercel自动启用Gzip压缩，无需配置。

## 🔐 安全建议

1. ✅ 环境变量已通过Vercel加密存储
2. ✅ `.env.local` 已在 `.gitignore` 中
3. ✅ API密钥不会暴露在前端代码中
4. ⚠️ 建议定期更换API密钥

## 📱 移动端适配

界面已自动适配移动端：
- 响应式布局
- 触摸友好的按钮
- 自适应卡片网格

## 🔄 持续部署

配置完成后，每次推送到GitHub main分支，Vercel会自动：
1. 检测代码变更
2. 触发构建
3. 运行测试
4. 部署到生产环境

## 📊 监控和分析

Vercel提供：
- **Analytics**: 访问量统计
- **Speed Insights**: 性能监控
- **Logs**: 实时日志查看
- **Usage**: 资源使用情况

## 🎉 部署成功后

分享你的项目：
- 复制Vercel提供的URL
- 或绑定自定义域名
- 在README中添加演示链接

## 📞 需要帮助？

- Vercel文档: https://vercel.com/docs
- Next.js文档: https://nextjs.org/docs
- 聚源AIDB: https://www.hs.net/openplat-doc/

---

**祝部署顺利！🚀**

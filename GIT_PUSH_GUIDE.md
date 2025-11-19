# 📝 Git推送完整步骤指南

## 🎯 适用场景

- 新项目首次推送到GitHub
- 代码修改后更新到远程仓库
- 多人协作开发

---

## 📋 首次推送（新项目）

### 步骤1: 初始化Git仓库

```bash
cd C:\Users\leesi\CascadeProjects\xx-etf-js
git init
```

**作用**: 在项目目录创建 `.git` 文件夹，开始版本控制

### 步骤2: 添加文件到暂存区

```bash
git add .
```

**作用**: 将所有文件添加到Git暂存区（准备提交）

**其他用法**:
- `git add file.js` - 只添加单个文件
- `git add *.js` - 添加所有.js文件
- `git add folder/` - 添加整个文件夹

### 步骤3: 提交到本地仓库

```bash
git commit -m "Initial commit: 高股息红利组合系统 - 基于聚源AIDB"
```

**作用**: 将暂存区的文件提交到本地Git仓库，并添加提交说明

**提交信息规范**:
- `feat: 添加新功能`
- `fix: 修复bug`
- `docs: 更新文档`
- `style: 代码格式调整`
- `refactor: 代码重构`
- `test: 添加测试`

### 步骤4: 添加远程仓库

```bash
git remote add origin https://github.com/gyzb1/xx-etf-js.git
```

**作用**: 关联GitHub远程仓库

**检查远程仓库**:
```bash
git remote -v
```

### 步骤5: 重命名分支为main

```bash
git branch -M main
```

**作用**: 将默认的 `master` 分支改名为 `main`（GitHub新标准）

### 步骤6: 推送到远程仓库

```bash
git push -u origin main
```

**作用**: 
- 将本地代码推送到GitHub
- `-u` 参数设置上游分支，之后只需 `git push` 即可

---

## 🔄 日常更新推送（已有仓库）

### 快速三步走

```bash
# 1. 添加修改的文件
git add .

# 2. 提交到本地
git commit -m "更新说明"

# 3. 推送到远程
git push
```

### 详细步骤

#### 1. 查看文件状态

```bash
git status
```

**输出示例**:
```
Changes not staged for commit:
  modified:   app/page.tsx
  modified:   app/api/portfolio/route.js

Untracked files:
  new-file.js
```

#### 2. 添加文件

```bash
# 添加所有修改
git add .

# 或选择性添加
git add app/page.tsx
git add app/api/portfolio/route.js
```

#### 3. 提交更改

```bash
git commit -m "feat: 美化界面，添加扣非净利润筛选"
```

#### 4. 拉取远程更新（多人协作时）

```bash
git pull origin main
```

**作用**: 获取远程仓库的最新代码，避免冲突

#### 5. 推送到远程

```bash
git push
```

或完整命令：
```bash
git push origin main
```

---

## 🌿 分支管理

### 创建新分支

```bash
# 创建并切换到新分支
git checkout -b feature/new-feature

# 或分两步
git branch feature/new-feature
git checkout feature/new-feature
```

### 切换分支

```bash
git checkout main
git checkout feature/new-feature
```

### 合并分支

```bash
# 切换到main分支
git checkout main

# 合并feature分支
git merge feature/new-feature
```

### 删除分支

```bash
# 删除本地分支
git branch -d feature/new-feature

# 删除远程分支
git push origin --delete feature/new-feature
```

---

## 🔍 常用查看命令

### 查看提交历史

```bash
git log

# 简洁版
git log --oneline

# 图形化显示
git log --graph --oneline --all
```

### 查看文件差异

```bash
# 查看未暂存的修改
git diff

# 查看已暂存的修改
git diff --staged

# 查看特定文件的修改
git diff app/page.tsx
```

### 查看远程仓库

```bash
git remote -v
```

---

## ⚠️ 常见问题和解决方案

### 1. 推送失败：认证问题

**错误信息**:
```
fatal: Authentication failed
```

**解决方案**:
```bash
# 使用Personal Access Token
# 1. 在GitHub生成Token: Settings → Developer settings → Personal access tokens
# 2. 使用Token作为密码
```

### 2. 推送失败：远程有新提交

**错误信息**:
```
! [rejected] main -> main (fetch first)
```

**解决方案**:
```bash
# 先拉取远程更新
git pull origin main

# 解决冲突后再推送
git push origin main
```

### 3. 撤销未提交的修改

```bash
# 撤销单个文件
git checkout -- file.js

# 撤销所有修改
git checkout -- .
```

### 4. 撤销已提交但未推送的提交

```bash
# 撤销最后一次提交，保留修改
git reset --soft HEAD~1

# 撤销最后一次提交，丢弃修改
git reset --hard HEAD~1
```

### 5. 修改最后一次提交信息

```bash
git commit --amend -m "新的提交信息"
```

### 6. 忽略文件

创建或编辑 `.gitignore` 文件：

```
# 依赖
node_modules/
.pnp
.pnp.js

# 环境变量
.env
.env.local
.env.*.local

# 构建输出
.next/
out/
dist/
build/

# 日志
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# 系统文件
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
```

---

## 🚀 完整工作流程示例

### 场景：修改代码并推送

```bash
# 1. 查看当前状态
git status

# 2. 修改代码...
# (在IDE中编辑文件)

# 3. 查看修改内容
git diff

# 4. 添加修改
git add .

# 5. 提交
git commit -m "feat: 添加新功能"

# 6. 推送
git push

# 完成！
```

### 场景：创建功能分支开发

```bash
# 1. 创建并切换到新分支
git checkout -b feature/add-filter

# 2. 开发新功能...
# (修改代码)

# 3. 提交到功能分支
git add .
git commit -m "feat: 添加筛选功能"

# 4. 推送功能分支
git push -u origin feature/add-filter

# 5. 在GitHub创建Pull Request

# 6. 合并后切回main分支
git checkout main
git pull origin main

# 7. 删除本地功能分支
git branch -d feature/add-filter
```

---

## 📱 使用GitHub Desktop（图形界面）

如果不习惯命令行，可以使用GitHub Desktop：

### 安装

下载地址: https://desktop.github.com/

### 基本操作

1. **克隆仓库**: File → Clone Repository
2. **查看更改**: 左侧显示所有修改的文件
3. **提交**: 
   - 填写提交信息
   - 点击 "Commit to main"
4. **推送**: 点击 "Push origin"
5. **拉取**: 点击 "Fetch origin" 或 "Pull origin"

---

## 🎓 Git最佳实践

### 1. 提交频率
- ✅ 经常提交，每完成一个小功能就提交
- ❌ 不要积累太多修改才提交

### 2. 提交信息
- ✅ 清晰描述做了什么
- ✅ 使用统一的格式（如：feat/fix/docs）
- ❌ 不要写"修改"、"更新"等模糊信息

### 3. 分支管理
- `main` - 生产环境代码
- `develop` - 开发环境代码
- `feature/*` - 功能开发分支
- `hotfix/*` - 紧急修复分支

### 4. 推送前检查
```bash
# 1. 查看状态
git status

# 2. 查看差异
git diff

# 3. 确认无误后推送
git push
```

### 5. 保护敏感信息
- ✅ 使用 `.gitignore` 忽略 `.env` 文件
- ✅ 不要提交API密钥、密码
- ✅ 使用环境变量管理配置

---

## 📚 快速参考

### 常用命令速查

| 命令 | 作用 |
|------|------|
| `git init` | 初始化仓库 |
| `git clone <url>` | 克隆远程仓库 |
| `git status` | 查看状态 |
| `git add .` | 添加所有文件 |
| `git commit -m "msg"` | 提交 |
| `git push` | 推送 |
| `git pull` | 拉取 |
| `git branch` | 查看分支 |
| `git checkout <branch>` | 切换分支 |
| `git merge <branch>` | 合并分支 |
| `git log` | 查看历史 |
| `git diff` | 查看差异 |

### 配置Git

```bash
# 设置用户名
git config --global user.name "Your Name"

# 设置邮箱
git config --global user.email "your.email@example.com"

# 查看配置
git config --list
```

---

## 🔗 相关资源

- **Git官方文档**: https://git-scm.com/doc
- **GitHub文档**: https://docs.github.com
- **Git可视化学习**: https://learngitbranching.js.org/
- **Git速查表**: https://training.github.com/downloads/zh_CN/github-git-cheat-sheet/

---

**记住：多练习，熟能生巧！** 🚀

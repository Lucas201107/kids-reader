# 上传到 GitHub 并部署到服务器 —— 操作指南

> **当前状态：仓库已创建并推送完成 ✅**
>
> - 仓库地址：**https://github.com/Lucas201107/kids-reader**（public）
> - 分支：`main`，提交数 2，共 **83 个文件**，仓库体积约 500 KB
> - 提交署名已绑定到 GitHub 账号（`Lucas201107 <295031867+Lucas201107@users.noreply.github.com>`）
> - 本地已配置 `origin` 与上游跟踪，`git push` / `git pull` 可直接用
> - 仓库**不含** `node_modules`、`dist`、`.env`、`*.db`、`uploads` 内容
>
> 也就是说，下面的「第 0～2 步」已经做完了，**你只需要看第 3 步（服务器部署）和第 4 步（日常更新）**。
> 保留完整步骤是为了说明当时怎么做的，以及仓库重建时可复用。

---

## 一、已经完成的步骤（存档备查）

### 第 0 步：提交署名

提交记录会公开展示作者名和邮箱。已设置为 GitHub 无痕邮箱，这样提交会自动挂到账号头像下：

```bash
git config user.name  "Lucas201107"
git config user.email "295031867+Lucas201107@users.noreply.github.com"
git commit --amend --reset-author --no-edit
```

> 想改用真实邮箱的话，换成 GitHub 账号里已验证的邮箱即可（否则提交不会计入贡献图）。

### 第 1 步：创建仓库

通过 GitHub API 创建，参数等价于网页操作：

- 仓库名 `kids-reader`，**public**（与已有的 `vocab3500` 保持一致）
- 未勾选 "Add a README / .gitignore / license"（本地已有，勾选会导致首次推送冲突）
- 默认分支 `main`

### 第 2 步：关联远程并推送

```bash
git remote add origin https://github.com/Lucas201107/kids-reader.git
git push -u origin main          # 本次用 token 认证完成
```

推送后校验：远端 `main` 的 SHA 与本地 `HEAD` 完全一致
（`3bfc8f1bac1bfd4ebeab691f852c753e6567e3aa`），远端 83 个文件齐全。

**关于认证方式**（下次推送时参考）：

- 本机没装 `gh` CLI，也没有 SSH 密钥，走 **HTTPS** 最省事
- 首次 `push` 会弹出 Git Credential Manager 窗口，选 **Sign in with your browser** 授权，
  凭证会被记住，后续推送不用再输
- 若弹出命令行要密码：GitHub 已不支持账号密码，需在
  Settings → Developer settings → Personal access tokens 生成 token（勾选 `repo` 权限）当密码用

> ⚠️ **token 安全**：GitHub 的 token 一旦泄露等同于账号写入权限。
> 用完请到 Settings → Developer settings → Personal access tokens 立即 **Delete** 并重新生成；
> 也**不要**把 token 写进 `.env`、脚本或任何会被提交的文件。

### 上传方式备选：网页拖拽

不想用命令行的话，也可以在仓库页面点 **Add file → Upload files** 拖入。
但要注意拖拽前先删掉 `server/node_modules`、`server/dist`、`server/.env`、`server/prisma/dev.db`、
`server/uploads` 里的内容，且后续更新只能重新拖拽、没法 `git pull`，所以**推荐用命令行**。

---

## 二、服务器上拉取并部署（首次）

登录服务器后：

```bash
# 1. 拉代码（首次）
git clone https://github.com/Lucas201107/kids-reader.git /opt/kids-reader
cd /opt/kids-reader

# 2. 配置生产环境变量
cp deploy/.env.production.example server/.env
vim server/.env
#    必填：PUBLIC_BASE_URL（公网 HTTPS 域名）、WECHAT_APPID/SECRET、
#          TENCENT_SECRET_ID/KEY、ADMIN_PASS、TEACHER_INVITE_CODE、JWT_SECRET
#    切换真实评测：MOCK_SOE=false

# 3. 一键部署（自动备份 → npm ci → 建表 → 导种子 → 编译 → PM2 重启）
SEED=yes bash deploy/deploy.sh

# 4. 备份挂定时任务
crontab -e
# 加入一行：0 3 * * * bash /opt/kids-reader/deploy/backup.sh
```

> 私有仓库在服务器上拉取需要凭证。
> 最省事的做法是在服务器上生成 SSH 密钥并加到 GitHub 的 Deploy keys（只读即可）：
>
> ```bash
> ssh-keygen -t ed25519 -C "server" -f ~/.ssh/id_ed25519 -N ""
> cat ~/.ssh/id_ed25519.pub     # 复制到 GitHub 仓库 → Settings → Deploy keys → Add
> git remote set-url origin git@github.com:Lucas201107/kids-reader.git
> ```

---

## 三、日常更新流程

本地改完代码后：

```bash
cd kids-reader
git add -A
git commit -m "fix: 修复xxx"
git push
```

服务器上：

```bash
cd /opt/kids-reader
git pull
bash deploy/deploy.sh          # 会自动先备份数据库，再编译重启
```

> `deploy.sh` 是幂等的，反复执行没问题。
> 服务器上的 `server/.env` 不会出现在仓库里，`git pull` 也不会覆盖它，放心。

---

## 四、改了数据库表结构怎么办

修改 `server/prisma/schema.prisma` 后推送，服务器上 `deploy.sh` 里的 `prisma db push` 会自动同步。

⚠️ **注意**：`db push` 对**删除字段/修改字段类型**这类破坏性变更可能丢数据。
遇到这种改动，先手动备份：

```bash
bash deploy/backup.sh
# 再执行部署
```

更规范的做法是改用 Prisma Migrate（`prisma migrate deploy`），
但班级规模的数据量下，`db push` + 每日备份已经够用。

---

## 五、常见问题

### 1. 中文文件名显示成一串数字（`\344\275\277...`）

Git 默认转义非 ASCII 路径，不影响使用，但看着难受。关掉：

```bash
git config --global core.quotepath false
```

### 2. 推送时提示 `remote: Support for password authentication was removed`

GitHub 不再支持账号密码，用以下任一方式：

- 装 Git Credential Manager，走浏览器授权（推荐）
- 生成 Personal Access Token 当作密码用
- 改用 SSH 密钥

### 3. 不小心把 `.env` 提交了

```bash
# 先从索引移除（保留本地文件）
git rm --cached server/.env
git commit -m "chore: 移除误提交的 .env"
git push
```

⚠️ 文件虽然从最新提交里移除了，但**历史记录里还有**。
如果里面有真实密钥，必须立刻去腾讯云/微信后台**重置密钥**，
因为 GitHub 的提交历史无法真正删除（除非重写历史并强推，比较麻烦）。

### 4. 推送被拒绝：`failed to push some refs`

空仓库建的时候勾选了 README，导致远程有一个初始提交，和本地冲突。两种处理：

```bash
# 方式一：保留远程的 README，把本地提交叠加上去
git pull --rebase origin main
git push -u origin main

# 方式二：远程内容不重要，直接覆盖（谨慎，会丢失远程提交）
git push -u origin main --force
```

### 5. 仓库体积异常大

检查有没有误提交大文件：

```bash
git ls-files | xargs ls -lh 2>/dev/null | sort -k5 -h | tail -10
```

正常情况下仓库应该在 500 KB 以内。若发现 `node_modules` 或 `*.db` 被提交，
确认 `.gitignore` 生效后按问题 3 的方式移除。

### 6. 小程序需要单独配置

`miniprogram/project.private.config.json`（含你本地开发者工具的私有配置）
已被 `.gitignore` 排除，不会上传。
`miniprogram/project.config.json` 里的 `appid` 建议在推送到公开仓库前改成占位符。

---

## 六、推送前自检清单

```bash
cd kids-reader

# 1. 工作区是否干净
git status

# 2. 确认敏感文件没被追踪（应该没有任何输出）
git ls-files | grep -E "\.env$|\.db$|node_modules|dist/"

# 3. 确认文件数量与体积正常（约 82 个文件）
git ls-files | wc -l
du -sh .

# 4. 查看将推送的内容
git log --stat -1
```

一项目标状态：

| 检查项 | 期望 |
| --- | --- |
| `git status` | `nothing to commit, working tree clean` |
| 敏感文件检查 | 无输出 |
| 文件数 | 82 |
| 仓库体积 | < 1 MB |

以上全部通过后，执行第 2 步的 `git push` 即可。

# 英语绘本跟读纠错系统（小学 3-6 年级 · 班级内使用）

> **仓库**：https://github.com/Lucas201107/kids-reader
>
> ```bash
> git clone https://github.com/Lucas201107/kids-reader.git
> ```

面向班级小范围使用的微信小程序：**英文绘本阅读 + 课文单词跟读 + 发音纠错 + 错词本 + 班级任务与报告**。

学生读完一遍，系统逐词给出评分，把读错、漏读、发音偏低的词标出来并沉淀到个人错词本；老师可以布置任务、看到班级完成率和高频错词。

---

## 一、功能清单

### 学生端（小程序）
- 微信一键登录，填昵称 / 选年级 / 输班级码加入班级
- 绘本阅读：分页跟读，逐页评分，可听示范音频
- 课文跟读：整篇短文评测，长文本自动切换段落模式
- 单词练习：按年级 / 单元筛选，单词逐个跟读；错词本一键复习
- **逐词纠错展示**：正常（绿）/ 发音偏低（橙）/ 读错（红波浪线）/ 漏读（灰色删除线）
- 个人学习报告：跟读次数、平均分、近 7 天练习曲线、错词 Top10

### 老师端（小程序内）
- 创建班级 → 生成 6 位班级码，学生扫码/输码加入
- 布置任务：选班级 + 选类型（单词/课文/绘本）+ 多选内容 + 截止时间
- 班级数据：活跃人数、跟读总次数、平均分、学生排行、**高频错词榜**
- 内容录入：批量粘贴单词、录入课文、分页录入绘本

### 管理后台（浏览器访问 `/admin/index.html`）
- 账号密码登录（`.env` 中配置）
- 单词 / 课文 / 绘本录入
- **Excel / CSV 批量导入**（含模板下载）
- **拍照 OCR 识别**英文文本（腾讯云 OCR）

---

## 二、技术选型

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 小程序 | 原生 WXML/WXSS/JS | 零依赖，微信开发者工具直接打开即可，无需 npm 构建 |
| 后端 | NestJS 10 + TypeScript | 模块化，7 个业务模块 |
| 数据库 | Prisma + SQLite（可切 MySQL） | 班级规模用 SQLite 足够，改 1 行配置即可换 MySQL |
| 鉴权 | 微信 code2session + JWT | 无需自建账号体系 |
| 发音评测 | 腾讯云智聆口语评测 SOE | 逐词 PronAccuracy + MatchTag，最专业的方案 |
| OCR | 腾讯云通用印刷体识别 | 拍照导入绘本 / 课本 |
| 文件存储 | 本地目录 + Nginx 静态托管 | 音频、图片；量大可换 COS |

> **开发模式**：`.env` 中 `MOCK_SOE=true` 时会返回模拟评分，无需腾讯云密钥即可跑通全流程；填入真实密钥并改为 `false` 即切换为真实评测。

---

## 三、目录结构

```
kids-reader/
├── server/                     # NestJS 后端
│   ├── src/
│   │   ├── main.ts             # 入口：/api 前缀、/static 静态资源、/admin 后台
│   │   ├── app.module.ts
│   │   ├── prisma.service.ts
│   │   ├── common/             # 鉴权 Guard、上传工具
│   │   ├── vendor/             # 微信登录、SOE 评测、OCR 适配层
│   │   └── modules/            # auth / class / content / reading / assignment / stats / upload
│   ├── prisma/schema.prisma    # 9 张表的数据库模型
│   ├── seeds/                  # 种子数据（122 词 + 3 课文 + 3 绘本）与导入脚本
│   ├── public/admin/           # Web 管理后台（单文件，无需构建）
│   └── uploads/                # 音频 / 图片 / 导入模板
├── miniprogram/                # 小程序端（8 个页面）
│   ├── pages/{login,index,book,reader,word,task,mine,teacher}/
│   └── utils/{api.js,recorder.js}   # api.js 会按 develop/trial/release 自动切换后端地址
├── deploy/                     # 上线用：脚本与配置（可直接用）
│   ├── deploy.sh               # 一键部署/更新（备份→装依赖→建表→编译→重启）
│   ├── backup.sh               # 数据库备份，可挂 crontab
│   ├── nginx.conf              # HTTPS + 静态音频 + 上传体积
│   ├── ecosystem.config.js     # PM2 守护配置
│   ├── .env.production.example # 生产环境变量模板
│   └── Dockerfile / docker-compose.yml
├── docs/
│   ├── 上传到GitHub指南.md
│   ├── 部署与上线清单.md
│   ├── 接口文档.md
│   └── 使用说明.md
├── .gitignore                  # 排除 node_modules / dist / .env / *.db / uploads
└── .gitattributes              # 强制 .sh 用 LF，避免服务器上 "bad interpreter"
```

---

## 四、从 GitHub 拉取后跑起来

### 本地开发（Windows / macOS）

```bash
git clone https://github.com/Lucas201107/kids-reader.git kids-reader && cd kids-reader/server

npm install                       # 1. 装依赖
cp .env.example .env              # 2. 配环境（默认值即可跑通）
npx prisma db push                # 3. 建表
npm run seed                      # 4. 导入种子内容（122 词 / 3 课文 / 3 绘本，可重复执行）
npm run start:dev                 # 5. 启动
```

打开 `http://localhost:3000/admin/index.html`（`admin / admin123`）即可看到管理后台。

### 服务器首次部署（Linux）

```bash
git clone https://github.com/Lucas201107/kids-reader.git /opt/kids-reader && cd /opt/kids-reader

cp deploy/.env.production.example server/.env
vim server/.env                   # 填域名、微信 AppID、腾讯云密钥、后台密码

SEED=yes bash deploy/deploy.sh    # 一键：备份 → npm ci → 建表 → 导种子 → 编译 → PM2 重启
bash deploy/backup.sh             # 先手动测一次备份
crontab -e                        # 加上：0 3 * * * bash /opt/kids-reader/deploy/backup.sh
```

之后每次更新只需要：

```bash
cd /opt/kids-reader && git pull && bash deploy/deploy.sh
```

> **注意**：仓库里**不包含** `node_modules/`、`dist/`、`.env`、`*.db`、`uploads/`。
> 这些都由上面的步骤在目标机器上重新生成，仓库体积只有几百 KB。
> 服务器上的 `server/.env` 是唯一需要手工维护的文件，`git pull` 不会覆盖它。

---

## 五、本地跑起来（分步说明）

```bash
cd server

# 1. 安装依赖
npm install

# 2. 配置环境变量（默认已带开发值，可直接用）
cp .env.example .env      # Windows: copy .env.example .env

# 3. 建库 + 生成 Prisma 客户端
npx prisma db push
npx prisma generate

# 4. 导入种子数据（可选：122 个单词 + 3 篇课文 + 3 本绘本）
npm run seed

# 5. 启动
npm run start:dev        # 或 npm run build && npm run start:prod
```

启动后：
- 接口地址：`http://localhost:3000/api`
- 管理后台：`http://localhost:3000/admin/index.html`（默认 admin / admin123）

### 小程序端

1. 微信开发者工具 → 导入项目 → 选择 `miniprogram` 目录（AppID 可先用测试号）
2. 详情 → 本地设置 → 勾选 **不校验合法域名**（开发阶段）
3. 首页点「我的」→ 退出登录 → 用昵称进入；老师需填教师邀请码（默认 `teacher2026`，在 `.env` 的 `TEACHER_INVITE_CODE`）
4. 老师进「我的 → 老师端」创建班级，把 6 位班级码发给学生

> 只做班级内部使用的话，**用体验版就够了**：开发者工具上传体验版，在微信公众平台把班级成员加为体验成员，无需提交审核、无需发布。

---

## 六、已验证

本地已实测通过（`MOCK_SOE=true`）：

- 管理后台登录、单词/绘本列表接口 ✓
- 老师登录 → 升级老师 → 创建班级（拿到班级码 `4ZAEUU`）✓
- 学生登录 → 输入班级码加入班级 ✓
- 跟读评测：上传录音 → 返回综合分 / 发音 / 流利 / 完整度 + 逐词 MatchTag + 错词列表 + 音频回放地址 ✓
- 错词本自动累加（`pen` 记 1 次，上次 46 分）✓
- 老师布置任务 → 学生任务列表显示完成状态与平均分 ✓
- 班级统计：活跃人数 1/1、跟读 1 次、平均分 55、排行、高频错词 ✓
- Excel 导入模板生成与导入（2 条成功）✓
- 静态资源与模板下载 200 ✓
- 错词本直传原文评测（`refId=0 + refText`）✓
- 错词移除接口 ✓、每日练习上限 403 提示 ✓
- 小程序 11 个 JS 文件语法检查 ✓、部署脚本 `bash -n` 检查 ✓
- 备份脚本实测：生成的 `.db.gz` 解压后为合法 SQLite 文件 ✓

## 七、上线

```bash
# 服务器上（代码放到 /opt/kids-reader）
git clone https://github.com/Lucas201107/kids-reader.git /opt/kids-reader && cd /opt/kids-reader
cp deploy/.env.production.example server/.env && vim server/.env
SEED=yes bash deploy/deploy.sh        # 首次部署
bash deploy/backup.sh                 # 测一次备份，然后挂 crontab
```

详见 `docs/部署与上线清单.md`（含 Nginx 配置、Docker 方案、验收清单、故障排查）。

## 八、后续可扩展

- **发音评测降级方案**：若想压低成本，可接微信「同声传译」插件做 ASR，再用文本比对找错词（后端 `vendor/soe.ts` 已留出 mock/真实两条路径，可平滑加第三条）
- 每日练习次数上限（控制 SOE 费用）
- 单词卡片翻转、听音选词等游戏化练习
- 班级排行榜、每周学习报告推送（订阅消息）
- 绘本配图上传与 AI 生成插图

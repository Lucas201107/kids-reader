#!/usr/bin/env bash
# 一键部署 / 更新脚本
# 用法：
#   bash deploy/deploy.sh                # 常规更新
#   SEED=yes bash deploy/deploy.sh       # 首次部署并导入种子数据
#   APP_DIR=/srv/kids/server bash deploy/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/kids-reader/server}"
DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
SEED="${SEED:-no}"

log() { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[警告]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[错误]\033[0m %s\n' "$*" >&2; exit 1; }

log "部署目录：$APP_DIR"

# ---------- 1. 环境检查 ----------
command -v node >/dev/null 2>&1 || die "未安装 Node.js，请先安装 Node 20（curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs）"
NODE_MAJOR="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node 版本过低（当前 $(node -v)），需要 18 及以上"

cd "$APP_DIR" || die "目录不存在：$APP_DIR"
[ -f .env ] || die "缺少 .env，请复制 deploy/.env.production.example 为 server/.env 并填写真实配置"

# ---------- 2. 部署前备份数据库 ----------
if ls prisma/*.db >/dev/null 2>&1; then
  log "备份数据库..."
  APP_DIR="$APP_DIR" bash "$DEPLOY_DIR/backup.sh" || warn "备份失败，继续部署（请手动确认数据安全）"
fi

# ---------- 3. 依赖 ----------
log "安装依赖（npm ci）..."
if [ -f package-lock.json ]; then
  npm ci || npm install
else
  npm install
fi

# ---------- 4. 数据库结构 ----------
log "同步数据库结构..."
npx prisma db push --skip-generate
npx prisma generate

if [ "$SEED" = "yes" ]; then
  log "导入种子数据（122 词 / 3 课文 / 3 绘本）..."
  npm run seed
fi

# ---------- 5. 编译 ----------
log "编译 TypeScript..."
npm run build
[ -f dist/src/main.js ] || die "编译产物缺失：dist/src/main.js"

# ---------- 6. 重启服务 ----------
if command -v pm2 >/dev/null 2>&1; then
  log "重启 pm2 进程..."
  pm2 startOrReload "$DEPLOY_DIR/ecosystem.config.js"
  pm2 save >/dev/null
  sleep 2
  pm2 describe kids-reader | grep -E "status|uptime" || true
else
  warn "未检测到 pm2，请手动启动：cd $APP_DIR && node dist/src/main.js"
  warn "安装 pm2：sudo npm i -g pm2 && pm2 start $DEPLOY_DIR/ecosystem.config.js && pm2 save && pm2 startup"
fi

log "部署完成 ✅"
log "自检：curl -s -o /dev/null -w '%{http_code}\n' https://你的域名/admin/index.html  应返回 200"

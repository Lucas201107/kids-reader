#!/usr/bin/env bash
# 数据备份脚本（数据库 + 可选上传文件），默认保留 30 天
# 用法：
#   bash deploy/backup.sh                     # 只备份数据库
#   WITH_UPLOADS=yes bash deploy/backup.sh    # 同时打包音频/图片
#
# 建议加到 crontab，每天凌晨 3 点自动备份：
#   0 3 * * * /bin/bash /opt/kids-reader/deploy/backup.sh >> /var/log/kids-reader/backup.log 2>&1
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/kids-reader/server}"
BACKUP_DIR="${BACKUP_DIR:-/opt/kids-reader/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

# ---------- 数据库 ----------
DB_FILE="$(ls "$APP_DIR"/prisma/*.db 2>/dev/null | head -1 || true)"
if [ -z "$DB_FILE" ]; then
  echo "[backup] 未找到数据库文件（$APP_DIR/prisma/*.db），跳过"
else
  if command -v sqlite3 >/dev/null 2>&1; then
    # 在线安全备份：即使服务正在写入也不会得到损坏的文件
    sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/db-$STAMP.db'"
  else
    echo "[backup] 未安装 sqlite3，退化为文件复制（建议 apt install -y sqlite3）"
    cp "$DB_FILE" "$BACKUP_DIR/db-$STAMP.db"
  fi
  gzip -f "$BACKUP_DIR/db-$STAMP.db"
  echo "[backup] 数据库已备份：db-$STAMP.db.gz ($(du -h "$BACKUP_DIR/db-$STAMP.db.gz" | cut -f1))"
fi

# ---------- 上传文件（音频/图片，体积大，按需开启） ----------
if [ "${WITH_UPLOADS:-no}" = "yes" ] && [ -d "$APP_DIR/uploads" ]; then
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$APP_DIR" uploads
  echo "[backup] 上传目录已打包：uploads-$STAMP.tar.gz"
fi

# ---------- 清理过期备份 ----------
find "$BACKUP_DIR" -name 'db-*.db.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true

echo "[backup] 完成，当前备份："
ls -lht "$BACKUP_DIR" | head -6

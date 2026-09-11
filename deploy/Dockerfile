# 构建上下文为项目根目录（kids-reader/），由 docker-compose.yml 指定
# 手动构建：docker build -f deploy/Dockerfile -t kids-reader-api .

# ---------- 构建阶段 ----------
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm ci

COPY server/prisma ./prisma
RUN npx prisma generate

COPY server/ ./
RUN npm run build

# ---------- 运行阶段 ----------
FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates sqlite3 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/seeds ./seeds
COPY server/package.json ./

RUN mkdir -p /app/uploads/audio /app/uploads/image /app/uploads/file /app/uploads/templates

EXPOSE 3000

# 容器内启动：先同步表结构，再启动服务（数据目录已挂载卷）
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/src/main.js"]

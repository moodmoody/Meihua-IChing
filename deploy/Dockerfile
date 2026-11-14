# 梅花易数 · 复刻版 —— 生产镜像
# build context 必须是仓库根（含 dist/ 与 server/）
FROM node:22-alpine AS deps
WORKDIR /app/server
COPY server/package.json server/pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --prod --frozen-lockfile || pnpm install --prod

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY dist ./dist
ENV PORT=8787 HOST=0.0.0.0
USER app
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/src/server.js"]

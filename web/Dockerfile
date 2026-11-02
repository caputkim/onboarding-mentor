# syntax=docker/dockerfile:1
# 멘토·운영 서비스 이미지. 빌드 컨텍스트는 mentor/ 루트 (plans/ 를 이미지에 넣기 위해):
#   리포 루트에서: docker buildx build --platform linux/arm64 -f web/Dockerfile -t <ECR>/nxtcloud-onboarding-prod-mentor:<tag> .
# 컨테이너 시작 시 prisma migrate deploy 를 먼저 돌리고 서버를 띄운다.

# ---------- 1) 의존성 + Prisma Client 생성 ----------
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY web/package.json web/package-lock.json ./
COPY web/prisma ./prisma
RUN npm ci --no-audit --no-fund --ignore-scripts \
 && npx prisma generate

# ---------- 2) Next standalone 빌드 ----------
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY web/ ./
RUN npm run build

# ---------- 3) 마이그레이션용 Prisma CLI (의존성 전체 + 스키마 엔진 선다운로드) ----------
FROM node:24-alpine AS prisma-cli
WORKDIR /tools
RUN apk add --no-cache libc6-compat openssl \
 && npm init -y > /dev/null \
 && npm install --no-audit --no-fund --ignore-scripts prisma@6 \
 && npx prisma version > /dev/null \
 && ls node_modules/@prisma/engines/ | grep -q schema-engine

# ---------- 4) 실행 이미지 ----------
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 PLANS_DIR=/app/plans
RUN apk add --no-cache libc6-compat openssl wget \
 && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=prisma-cli --chown=app:app /tools/node_modules ./prisma-cli/node_modules
COPY --chown=app:app plans ./plans
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD wget -qO- http://127.0.0.1:3000/login > /dev/null || exit 1
CMD ["sh", "-c", "node prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma && node server.js"]

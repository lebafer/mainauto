FROM oven/bun:1.3.14 AS runtime

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV BUN_INSTALL_CACHE_DIR=/tmp/bun-cache

RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium \
  fonts-dejavu-core \
  fonts-liberation \
  ca-certificates \
  curl \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile

COPY backend ./

RUN bunx prisma generate
RUN mkdir -p /app/uploads \
  && chown -R bun:bun /app/uploads \
  && chmod 0700 /app/uploads

USER bun

EXPOSE 3000

CMD ["sh", "-c", "bunx prisma migrate deploy && exec bun src/index.ts"]

FROM oven/bun:1.2 AS runtime

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium \
  fonts-dejavu-core \
  fonts-liberation \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/bun.lock ./
RUN bun install

COPY backend ./

RUN bunx prisma generate
RUN mkdir -p /app/uploads /app/backups

EXPOSE 3000

CMD ["sh", "-c", "bunx prisma migrate deploy && bun src/index.ts"]

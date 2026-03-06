FROM oven/bun:1.1 AS runtime

WORKDIR /app

COPY backend/package.json backend/bun.lock ./
RUN bun install

COPY backend ./

RUN bunx prisma generate
RUN mkdir -p /app/uploads /app/backups

EXPOSE 3000

CMD ["sh", "-c", "bunx prisma migrate deploy && bun src/index.ts"]

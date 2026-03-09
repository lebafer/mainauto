FROM oven/bun:1.2 AS builder

WORKDIR /app

COPY webapp/package.json webapp/bun.lock ./
RUN bun install

COPY webapp ./
# Keep shared API contracts available for imports like ../../../../backend/src/types
RUN mkdir -p /app/backend/src
COPY backend/src/types.ts /app/backend/src/types.ts

ARG VITE_BACKEND_URL=
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

RUN bun run build

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

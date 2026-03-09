FROM oven/bun:1.2 AS builder

WORKDIR /app

COPY webapp/package.json webapp/bun.lock ./
RUN bun install

COPY webapp ./
# Keep shared API contracts available for imports like ../../../../backend/src/types
RUN mkdir -p /backend/src && ln -s /app/node_modules /backend/node_modules
COPY backend/src/types.ts /backend/src/types.ts

ARG VITE_BACKEND_URL=
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

RUN bun run build

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

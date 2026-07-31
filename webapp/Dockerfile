FROM oven/bun:1.3.14 AS builder

WORKDIR /app

COPY webapp/package.json webapp/bun.lock ./
RUN bun install --frozen-lockfile

COPY webapp ./
# Keep shared API contracts and their env-free helpers available for imports
# like ../../../../backend/src/types.
RUN mkdir -p /backend/src/lib && ln -s /app/node_modules /backend/node_modules
COPY backend/src/types.ts /backend/src/types.ts
COPY backend/src/lib/money.ts /backend/src/lib/money.ts

ARG VITE_BACKEND_URL=
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ARG VITE_PUBLIC_APP_URL=
ENV VITE_PUBLIC_APP_URL=${VITE_PUBLIC_APP_URL}

RUN bun run build

FROM nginx:1.27.5-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

FROM oven/bun:1.2 AS builder

WORKDIR /app

COPY webapp/package.json webapp/bun.lock ./
RUN bun install

COPY webapp ./

ARG VITE_BACKEND_URL=
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

RUN bun run build

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

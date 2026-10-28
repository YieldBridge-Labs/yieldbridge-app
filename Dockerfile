# Stage 1: Build workspace artifacts
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Cache dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/dashboard/package.json ./apps/dashboard/

RUN pnpm install --frozen-lockfile

# Copy source and build packages
COPY packages/sdk ./packages/sdk
RUN pnpm --filter @yieldbridge/sdk build

COPY apps/dashboard ./apps/dashboard
RUN pnpm --filter @yieldbridge/dashboard build

# Stage 2: Hardened Alpine Nginx static web server
FROM nginx:alpine-slim

# Copy compiled SPA bundle and Nginx configuration
COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Run as non-root / standard Nginx ports
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
ENV WRANGLER_SEND_METRICS=false CLOUDFLARE_CF_FETCH_ENABLED=false
COPY package.json package-lock.json ./
RUN npm ci --include=dev --include=optional --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24.19.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production FSP_DATA_DIR=/data WRANGLER_SEND_METRICS=false CLOUDFLARE_CF_FETCH_ENABLED=false
COPY --from=build /app /app
RUN mkdir -p /data /app/.wrangler && chown -R node:node /data /app/.wrangler /app/dist
USER node
EXPOSE 8080
VOLUME /data
CMD ["node", "scripts/docker-start.mjs"]

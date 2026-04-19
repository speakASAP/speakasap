FROM node:24-slim AS base
WORKDIR /app
ENV npm_config_update_notifier=false

FROM base AS deps
COPY package*.json ./
RUN npm install --omit=dev

FROM base AS build
COPY package*.json ./
RUN npm install
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV npm_config_update_notifier=false
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
ENTRYPOINT ["node"]
CMD ["dist/main.js"]

FROM node:24-slim AS base
WORKDIR /app
ENV npm_config_update_notifier=false
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS build
ARG NEXT_PUBLIC_API_URL=https://speakasap.alfares.cz
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY next.config.ts ./
COPY tsconfig.json ./
COPY postcss.config.mjs ./
COPY app ./app
COPY lib ./lib
COPY public ./public
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV npm_config_update_notifier=false
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=4211
ENV NEXT_PUBLIC_API_URL=https://speakasap.alfares.cz
COPY --from=build /app/public ./public
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/.next/standalone ./
EXPOSE 4211
HEALTHCHECK --interval=30s --timeout=10s --retries=3   CMD curl -f http://localhost:4211/ || exit 1
CMD ["node", "server.js"]

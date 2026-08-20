FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl1.1-compat || apk add --no-cache openssl
ENV npm_config_update_notifier=false
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev

FROM base AS build
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
# ffmpeg supplies ffprobe, which the lesson-record duration backfill uses to read an
# MP3's length from its header over a presigned URL. It was previously `apk add`-ed into
# the running pod by hand and lost on every restart, which is why the scheduled ingest
# could not be relied on.
RUN apk add --no-cache openssl1.1-compat wget ffmpeg || apk add --no-cache openssl wget ffmpeg
ENV NODE_ENV=production
ENV npm_config_update_notifier=false
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
COPY prisma ./prisma
# The CronJob runs these against the same image the service runs.
COPY scripts ./scripts
EXPOSE 4206
CMD ["node", "dist/main.js"]

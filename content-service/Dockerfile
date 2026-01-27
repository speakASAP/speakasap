FROM node:22-alpine AS base
WORKDIR /app
# Install OpenSSL for Prisma query engine
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
# Install OpenSSL for Prisma query engine
RUN apk add --no-cache openssl1.1-compat || apk add --no-cache openssl
ENV NODE_ENV=production
ENV npm_config_update_notifier=false
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
COPY prisma ./prisma
EXPOSE ${PORT}
CMD ["node", "dist/main.js"]

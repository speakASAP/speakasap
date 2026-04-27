FROM node:22-alpine AS base
WORKDIR /app
ENV npm_config_update_notifier=false

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
RUN apk add --no-cache wget
ENV NODE_ENV=production
ENV npm_config_update_notifier=false
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY package*.json ./
EXPOSE 4212
CMD ["node", "dist/main.js"]

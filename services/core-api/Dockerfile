# build context = services/core-api
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN npm run build

# ไม่ prune devDependencies: ต้องใช้ prisma CLI (migrate) และ tsx (seed) ตอนสตาร์ท
FROM node:20-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY prisma ./prisma
COPY scripts ./scripts
USER node
EXPOSE 4000
CMD ["sh", "scripts/start-prod.sh"]

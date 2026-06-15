FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY server/ ./server/
COPY client/ ./client/
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install && npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist
RUN mkdir -p /app/data/logos/providers /app/data/logos/cards
COPY data/logos/ /app/data/logos/
VOLUME ["/app/data"]
EXPOSE 3080
ENV NODE_ENV=production
CMD ["node", "server/index.js"]

FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY migrations/ ./migrations/
COPY public/ ./public/

RUN addgroup -S nova && adduser -S nova -G nova
USER nova

EXPOSE 3000

CMD ["node", "src/index.js"]

FROM node:22 AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:22-slim

WORKDIR /app

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
  sqlite3 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]

# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/.next ./.next
COPY --from=build /app/package*.json ./

# installiere next zur Laufzeit (damit der "next" Befehl existiert)
RUN npm install next

EXPOSE 3000
CMD ["npx", "next", "start"]

# ── Stage 1: Dependencies 
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Production Image 
FROM node:20-alpine AS runner
WORKDIR /app

# Security: run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p logs && chown -R appuser:nodejs /app
USER appuser

EXPOSE 5000


CMD ["node", "src/server.js"]

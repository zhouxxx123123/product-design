# Multi-stage build for production
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install ALL dependencies (devDeps required for nest build)
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files then install production-only deps (lean image)
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --omit=dev

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Install curl for healthcheck
RUN apk add --no-cache curl

# Pre-create uploads directory with correct ownership
RUN mkdir -p /app/uploads && chown nodejs:nodejs /app/uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:3000/api/v1/health/liveness || exit 1

# Switch to non-root user
USER nodejs

# Start application
CMD ["node", "dist/main.js"]

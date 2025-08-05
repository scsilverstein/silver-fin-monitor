# Multi-stage Dockerfile for Silver Fin Monitor
# Following CLAUDE.md production specifications

# Stage 1: Base dependencies
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Stage 2: Dependencies installation
FROM base AS deps
# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci
RUN cd frontend && npm ci

# Stage 3: Frontend builder
FROM base AS frontend-builder
WORKDIR /app
# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
# Copy frontend source
COPY frontend ./frontend
COPY tsconfig*.json ./
# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Stage 4: Backend builder
FROM base AS backend-builder
WORKDIR /app
# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy backend source
COPY src ./src
COPY tsconfig*.json ./
COPY package*.json ./
# Build backend
RUN npm run build:backend

# Stage 5: Production image
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=backend-builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/dist ./frontend/dist

# Copy necessary files
COPY --chown=nodejs:nodejs ecosystem.config.js ./
COPY --chown=nodejs:nodejs .env.example ./

# Create necessary directories
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["node", "dist/server.js"]
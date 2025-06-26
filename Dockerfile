FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Set timezone to JST
RUN apk add --no-cache tzdata
ENV TZ=Asia/Tokyo

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user and switch to it
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs
USER nodejs

# Set environment variables
ENV NODE_ENV=production

# Command to run the application
CMD ["node", "dist/index.js"]

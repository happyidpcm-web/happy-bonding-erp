# Stage 1: Build static assets and Prisma Client
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy all source files
COPY . .

# Generate Prisma Client and build static Vite frontend
RUN npx prisma generate
RUN npm run build

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copy package files and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies needed for production runtime
RUN npm ci

# Copy compiled frontend dist from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend server code
COPY server ./server

# Expose application port
EXPOSE 4000

# Entrypoint: sync DB schema if needed and start server
CMD ["sh", "-c", "npx prisma db push && npm run start"]

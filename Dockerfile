# syntax=docker/dockerfile:1

# Build stage: install dependencies and compile the React app
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies based on lockfile for reproducible builds
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build the production bundle
COPY . .
RUN npm run build

# Runtime stage: serve the static bundle with a lightweight HTTP server
FROM node:18-alpine AS runner
WORKDIR /app

# Runtime dependencies for healthchecks and static serving
RUN apk add --no-cache curl \
    && npm install --global serve@14

# Copy the build artifacts from the builder stage only
COPY --from=builder /app/build ./build

ENV NODE_ENV=production
EXPOSE 3000

# Serve the compiled React app on port 3000
CMD ["serve", "-s", "build", "-l", "3000"]

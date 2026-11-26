 # ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

# Create app directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies (include dev for build)
RUN npm install --legacy-peer-deps

# Copy the rest of the app
COPY . .

# Build the app and prune dev deps
RUN npm run build && npm prune --omit=dev --legacy-peer-deps

# ---------- Stage 2: Runtime ----------
FROM node:20-alpine

WORKDIR /app

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

# Copy only the built app + node_modules from builder
COPY --from=builder /app /app

# Uploads live outside /app so an image rebuild does not replace them.
# Keep them with a named volume: -v nfs-uploads:/data/uploads
ENV UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads/images /data/uploads/files
VOLUME ["/data/uploads"]

# App listens on PORT from env (default 8383).
# docker run -d --name nfs-api -p 8383:8383 --env-file .env -v nfs-uploads:/data/uploads nfs-api
# Important: Docker --env-file does not strip quotes. Use DB_URL=mongodb://... with no quotes.
EXPOSE 8383

CMD ["npm", "start"]

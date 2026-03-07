FROM node:22-alpine AS builder
WORKDIR /app

# Copy root workspace manifest + backend package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install all workspace deps from root (resolves hoisting correctly)
RUN npm ci --workspace=backend --include-workspace-root

# Build the backend TypeScript
COPY backend/tsconfig.json ./backend/
COPY backend/src/ ./backend/src/
RUN npm run build --workspace=backend

FROM node:22-alpine AS runner
WORKDIR /app/backend

# Copy the resolved node_modules from both root and backend
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY backend/package.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]

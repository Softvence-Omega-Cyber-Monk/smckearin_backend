# ====== BUILD STAGE ======
FROM node:24-slim AS builder

# Set PNPM environment
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install pnpm via npm (more robust than corepack in some environments)
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Install system dependencies for build
RUN apt update && apt install -y openssl

# Copy package, lock file & prisma folder
COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma.config.ts ./
COPY prisma ./prisma

# Install dependencies (skip build scripts to avoid approval prompt)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Run only the build scripts we actually need
RUN pnpm rebuild bcrypt prisma @prisma/engines

# Generate Prisma Client (dummy DATABASE_URL is sufficient for code generation)
RUN DATABASE_URL="postgresql://user:password@localhost:5432/db" pnpm prisma generate

# Copy rest of the project files
COPY . .

# Build the app (NestJS -> dist/)
RUN pnpm build

# ====== PRODUCTION STAGE ======
FROM node:24-slim AS production

# Set PNPM environment
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install pnpm via npm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Install system dependencies needed at runtime
RUN apt update && apt install -y openssl curl

# Copy necessary files from builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/.npmrc ./.npmrc
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/prisma ./prisma

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Rebuild native modules needed at runtime
RUN pnpm rebuild bcrypt @prisma/engines

# Expose the port
EXPOSE 3000

# Run the app
CMD ["pnpm", "start"]
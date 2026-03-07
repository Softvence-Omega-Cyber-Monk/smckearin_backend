# smckearin_backend

## 📁 Project Structure

```text
├── .github/workflows/     # CI/CD configuration
├── .husky/               # Git hooks
├── prisma/
│   ├── schema/          # Split Prisma schema files
│   ├── migrations/      # Database migrations
│   └── generated/       # Generated Prisma Client
├── scripts/             # Utility scripts (ci-hooks.js)
├── src/
│   ├── main.ts         # Application entry point
│   ├── app.module.ts   # Root module
│   ├── core/           # Infrastructure & global configs
│   │   ├── filter/     # Exception filters
│   │   ├── jwt/        # JWT strategy & guards
│   │   ├── middleware/ # Logger middleware
│   │   ├── pipe/       # Validation pipes
│   │   └── socket/     # WebSocket base gateway
│   ├── common/         # Shared utilities
│   │   ├── dto/        # Data Transfer Objects
│   │   ├── enum/       # Shared enums
│   │   └── utils/      # Helper functions
│   ├── lib/            # Feature modules (reusable)
│   │   ├── chat/       # Real-time chat
│   │   ├── file/       # File uploads
│   │   ├── mail/       # Email service
│   │   ├── prisma/     # Prisma service
│   │   ├── queue/      # Job queues
│   │   ├── seed/       # Database seeding
│   │   └── utils/      # Feature utilities
│   └── main/           # Application modules
│       ├── auth/       # Authentication
│       └── upload/     # Upload endpoints
├── Dockerfile          # Production Docker image
├── Dockerfile.dev      # Development Docker image
├── compose.yaml        # Production Docker Compose
├── compose.dev.yaml    # Development Docker Compose
├── Caddyfile          # Reverse proxy configuration
└── Makefile           # Command shortcuts

```

## 🛠️ Setup & Installation

### Prerequisites

- Node.js 24+
- pnpm 10+
- Docker & Docker Compose
- PostgreSQL 17
- Redis

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# App
NODE_ENV= production
BASE_URL= http://localhost:3000
PORT= 3000

# Docker
DOCKER_USERNAME=softvence
PACKAGE_NAME=nestjs_starter
PACKAGE_VERSION=latest

# Turn server
TURN_USERS=webrtcuser:webrtcuser
EXTERNAL_IP=10.10.10.52

# Database
DATABASE_URL= postgresql://postgres:postgres@localhost:5433/nestjs_starter_db

# Redis
REDIS_HOST= localhost
REDIS_PORT= 22376

# JWT
JWT_SECRET=secret
JWT_EXPIRES_IN=90d

# SMTP
MAIL_USER=test
MAIL_PASS=test

# Seed Admin
SUPER_ADMIN_EMAIL=test
SUPER_ADMIN_PASS=test

# AWS S3
AWS_REGION=test
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_S3_BUCKET_NAME=test
```

### Local Development (Hybrid) Setup

Start dependencies (DB + Redis) in Docker, run app locally:

```bash
# Start dependencies
make local-up

# Run app in dev mode
pnpm dev
```

Or use the combined command:

```bash
make local
```

### Full Docker Development

Run entire stack (app + dependencies) in Docker with live reload:

```bash
# Start dev environment
make dev-up

# View logs
make dev-logs

# Stop environment
make dev-stop
```

### Production

```bash
# Build Docker image
make build

# Start production stack
make start

# View logs
make logs

# Stop stack
make stop
```

## 📜 Available Commands

### Makefile Commands

#### Production (Default)

- `make build` - Build Docker image
- `make up` - Start containers (attached)
- `make start` - Start containers (detached)
- `make stop` - Stop containers
- `make restart` - Restart containers
- `make logs` - Show all logs
- `make logs-api` - Show API logs only
- `make clean` - Remove containers, volumes, images
- `make push` - Push image to Docker Hub
- `make ps` - List containers

#### Development (Full Docker)

- `make dev-up` - Start dev environment
- `make dev-stop` - Stop dev environment
- `make dev-logs` - Show dev logs
- `make dev-clean` - Clean dev environment
- `make dev-ps` - List dev containers

#### Local Development (Hybrid)

- `make local-up` - Start DB & Redis only
- `make local-down` - Stop DB & Redis
- `make local` - Start deps + run `pnpm dev`

#### General

- `make images` - List Docker images
- `make volumes` - List Docker volumes
- `make networks` - List Docker networks

### Package.json Scripts

```bash
# Development
pnpm dev              # Start dev server with watch mode
pnpm build            # Build for production
pnpm start            # Run production build

# Code Quality
pnpm lint             # Check linting issues
pnpm lint:fix         # Fix linting issues
pnpm format           # Check formatting
pnpm format:fix       # Fix formatting
pnpm ci:check         # Run all CI checks
pnpm ci:fix           # Fix all CI issues
pnpm commit           # Interactively generate commit message (recommended)

# Database
pnpm prisma           # Prisma CLI
pnpm db:push          # Push schema changes
pnpm db:generate      # Generate Prisma Client
pnpm db:migrate       # Create migration
pnpm db:deploy        # Deploy migrations
pnpm db:studio        # Open Prisma Studio
pnpm db:validate      # Validate schema
pnpm db:format        # Format schema files
```

## 🔄 CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci-cd.yml`):

1. **CI Check** (on PR/push to main)
   - Install dependencies
   - Generate Prisma Client
   - Lint check
   - Format check
   - Build validation

2. **Build & Push** (on merge to main)
   - Build Docker image
   - Push to Docker Hub
   - Tag with `latest`, version, and commit SHA

3. **Deploy** (on merge to main)
   - Transfer files via SCP
   - SSH into VPS
   - Pull and restart containers

### VPS Deployment Prerequisites

> **⚠️ IMPORTANT**: Before the first deployment, you must manually set up your VPS server.

#### Required Software

1. **Docker Compose V2** - Verify installation:

   ```bash
   docker compose version
   # Expected output: Docker Compose version v2.x.x or higher
   ```

   If not installed, install Docker Compose V2:

   ```bash
   # Install Docker (if not already installed)
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # Docker Compose V2 comes with Docker by default
   # Verify installation
   docker compose version
   ```

2. **Git** (optional, for manual deployments)

#### Environment Variables Setup

**⚠️ CRITICAL**: The `.env` file is NOT transferred via CI/CD for security reasons. You must create it manually on your VPS.

1. SSH into your VPS server
2. Navigate to the deployment directory:
   ```bash
   cd /home/<VPS_USER>/server
   ```
3. Create `.env` file with all required variables:
   ```bash
   nano .env
   ```
4. Copy ALL variables from `.env.example` and set production values:
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - Strong random secret
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` - S3 credentials
   - `MAIL_USER` / `MAIL_PASS` - SMTP credentials
   - `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASS` - Initial admin credentials
   - All other required environment variables

5. Save and secure the file:
   ```bash
   chmod 600 .env
   ```

#### GitHub Secrets Configuration

Configure the following secrets in your GitHub repository (`Settings > Secrets and variables > Actions`):

- `DOCKER_USERNAME` - Docker Hub username
- `DOCKER_PASSWORD` - Docker Hub password/token
- `PACKAGE_NAME` - Package name (e.g., `smckearin_backend`)
- `PACKAGE_VERSION` - Version tag (e.g., `latest`)
- `VPS_HOST` - VPS server IP or domain
- `VPS_USER` - SSH user for deployment
- `VPS_SSH_PRIVATE_KEY` - SSH private key for authentication

3. **Deploy** (automated after VPS setup)
   - Transfers configuration files to VPS
   - Pulls latest Docker images
   - Restarts containers with zero downtime

4. **Release** (Automated)
   - Analyzes commits via Semantic Release
   - Bumps version (package.json)
   - Generates CHANGELOG.md
   - Publishes GitHub Release

## 🐳 Docker Architecture

### Production (`compose.yaml`)

- **server** - NestJS API (multi-stage build)
- **db** - PostgreSQL 17
- **redis-master** - Redis primary
- **redis-replica** - Redis replica for HA
- **caddy** - Reverse proxy with auto-HTTPS
- **coturn** - TURN server for WebRTC

### Development (`compose.dev.yaml`)

- **app** - NestJS with hot reload
- **db** - PostgreSQL
- **redis-master** - Redis

### Key Features

- Health checks for all services
- Volume persistence
- Network isolation
- Production-ready reverse proxy

## 📝 Code Quality

### Pre-commit Hooks

Husky triggers `lint-staged` and `commitlint` on commit:

- **Lint Staged**: Runs `eslint` and `prettier` on staged files to ensure code quality before it's committed.
- **Commitlint**: Enforces conventional commit message format.

### Commit Guidelines

We use **Conventional Commits**. The easiest way to commit is:

```bash
pnpm commit
```

This triggers an interactive prompt (`commitizen`) to help you create a valid commit message.
Alternatively, ensure your commits follow the format: `type(scope): subject` (e.g., `feat: add new login page`).

### Linting & Formatting

- **ESLint** - TypeScript-ESLint rules
- **Prettier** - Consistent code style
- **Auto-fix** - Both tools auto-fix on commit

## 🔐 Security Features

- JWT with refresh token rotation
- Bcrypt password hashing
- OTP-based email verification
- Role-based access control
- CORS configuration
- Rate limiting ready

## 📚 API Documentation

Swagger UI available at `/docs` when running the server.

## 📄 License

UNLICENSED - Private/Commercial use

## 👤 Author

[@shahadathhs](https://github.com/shahadathhs)

---

Built with ❤️ using NestJS, Prisma, and Docker

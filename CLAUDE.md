# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Accommodation Finder API - A NestJS backend for a rental listing system with JWT authentication, email OTP verification, and Redis caching.

## Common Commands

### Development
```bash
# Start development server with watch mode
npm run start:dev

# Build for production
npm run build

# Start production server
npm run start:prod
```

### Testing
```bash
# Run unit tests
npm run test

# Run unit tests in watch mode
npm run test:watch

# Run e2e tests
npm run test:e2e

# Run single test file
npx jest src/modules/auth/auth.service.spec.ts

# Run tests with coverage
npm run test:cov
```

### Linting and Formatting
```bash
# Run ESLint with auto-fix
npm run lint

# Format with Prettier
npm run format
```

### Database (Prisma)
```bash
# Generate Prisma client after schema changes
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Deploy migrations in production
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio
```

## Architecture Overview

### Tech Stack
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Session Store**: Upstash Redis (REST API)
- **Authentication**: JWT (access token) + Redis (refresh token rotation)
- **Email**: Nodemailer with Handlebars templates
- **Real-time Chat**: Socket.IO with JWT authentication
- **API Docs**: Swagger at `/api/docs`

### Project Structure
```
src/
├── modules/          # Feature modules
│   ├── auth/         # JWT + OTP email verification
│   ├── chat/         # Real-time messaging with Socket.IO
│   ├── user/         # User management
│   ├── listing/      # Rental listings with status workflow
│   └── review/       # Listing reviews
├── integrations/     # External service integrations
│   ├── mail/         # Email service with HBS templates
│   └── map/          # Map/OpenStreetMap integration
├── common/           # Shared utilities
│   ├── filters/      # Exception filters
│   ├── decorators/   # Custom decorators
│   ├── guards/       # Auth guards
│   ├── interceptors/ # Request/response interceptors
│   ├── pipes/        # Validation pipes
│   └── utils/        # Helper functions
├── prisma/           # Prisma service and module
├── redis/            # Upstash Redis module (global)
└── configs/          # Configuration files
```

### Authentication Flow

1. **Registration**: `POST /auth/register` → creates user + sends OTP email
2. **Email Verification**: `POST /auth/verify-email` → validates OTP, marks user verified
3. **Login**: `POST /auth/login` → returns access token + refresh token
4. **Token Refresh**: `POST /auth/refresh` → rotates refresh token in Redis
5. **Logout**: `POST /auth/logout` → deletes refresh token from Redis

**Token Storage**:
- Access tokens: JWT with 7-day expiry
- Refresh tokens: Redis with 30-day TTL, rotated on each refresh
- OTP codes: Redis with 10-minute TTL, 1-minute rate limit between resends

### Listing Status Workflow

Listings have a state machine with these statuses:
- `DRAFT` → `PENDING` (user submits)
- `PENDING` → `ACTIVE` (admin approves, sets expiry)
- `PENDING` → `REJECTED` (admin rejects with note)
- `ACTIVE` → `PAUSED` (user hides)
- `ACTIVE` → `EXPIRED` (auto after 60 days)

### Key Configuration

Environment variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET_KEY` - Secret for JWT signing
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - Redis config
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` - Email server config
- `FRONTEND_URL` - For email template links

### Global Setup

**main.ts** configures:
- CORS (allow all origins)
- Global prefix `/api` (except `/api/docs`)
- Swagger documentation at `/api/docs`
- Global ValidationPipe with whitelist
- Global HttpExceptionFilter
- BigInt serialization fix for Prisma

### Testing

- Unit tests: `*.spec.ts` files alongside source
- E2E tests: `test/*.e2e-spec.ts`
- Jest config in `package.json` and `test/jest.config.ts`
### Real-time Chat (Socket.IO)

**WebSocket Gateway**: `ChatGateway` at namespace `/chat`

**Socket Events**:
| Event | Direction | Description |
|-------|-----------|-------------|
| `join_chat` | Client → Server | Join a chat room (with chatId) |
| `leave_chat` | Client → Server | Leave a chat room |
| `send_message` | Client → Server | Send a message to chat |
| `typing` | Client → Server | Emit typing indicator |
| `mark_as_read` | Client → Server | Mark messages as read |
| `new_message` | Server → Client | Broadcast new message to room |
| `user_typing` | Server → Client | Typing indicator from other user |
| `messages_read` | Server → Client | Read receipt notification |
| `notification` | Server → Client | Global new message notification |

**Authentication**: Pass JWT token via:
- Socket auth: `{ token: "Bearer xxx" }`
- Query param: `?token=Bearer%20xxx`
- Header: `Authorization: Bearer xxx`

**REST Endpoints**:
- `POST /chats` - Create/get chat
- `GET /chats` - Get user's chats
- `GET /chats/:chatId/messages` - Get messages
- `GET /chats/unread/count` - Get unread count


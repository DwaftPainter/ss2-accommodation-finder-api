# Backend - NestJS & Prisma

## Stack
- **Framework:** NestJS
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Caching:** Redis
- **Search:** OpenSearch
- **AI:** Ollama (Local LLM)
- **Real-time:** Socket.io

## Backend Conventions
- **Module Structure:** Follow the standard NestJS module structure (Controller -> Service -> Repository/Prisma).
- **Validation:** Use `class-validator` and `class-transformer` for DTOs.
- **Error Handling:** Use custom exceptions or the built-in `HttpException` with appropriate status codes.
- **DTOs:** Define explicit DTOs for all request bodies and response payloads.
- **Prisma:** Always run `npx prisma generate` after schema changes. Use migrations for all database updates.

## Testing
- **Unit Tests:** Located alongside the source code with `.spec.ts` extension.
- **E2E Tests:** Located in the `test/` directory.
- Run tests with `npm test` or `npm run test:e2e`.

## Development
- Use `npm run start:dev` for local development with hot-reload.
- Ensure `.env` is configured based on `.env.example`.

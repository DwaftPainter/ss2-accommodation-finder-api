# Accommodation Finder API

## Overview
Accommodation Finder API is a NestJS backend for an accommodation listing platform. It handles authentication, user profiles, accommodation listings, saved listings, reviews, notifications, chat, search and filtering, geocoding, OpenSearch indexing, and AI-assisted accommodation queries.

## Tech Stack
- NestJS
- TypeScript
- Prisma
- PostgreSQL
- OpenSearch
- Upstash Redis
- Socket.IO
- Swagger / OpenAPI
- Cloudinary
- Nodemailer / SMTP
- OpenStreetMap Nominatim
- Ollama
- Docker

## Features
- JWT authentication with register, login, refresh, logout, email verification OTP, and Google login endpoints
- User profile management and user search
- Accommodation listing CRUD, image uploads, saved listings, search, filtering, nearby search, and address-based search
- Review creation, update, delete, and review notifications
- Notification listing and read-state management
- REST chat endpoints plus a Socket.IO chat gateway
- OpenSearch indexing and search for listings, users, and chat messages
- PostgreSQL data access through Prisma
- Seed data generation for listings and related records
- Map geocoding and reverse geocoding through OpenStreetMap Nominatim
- Mail delivery for verification and notification flows
- Ollama-based AI chat endpoint
- Docker-based application runtime

## Project Structure
```text
src/
  app.module.ts
  main.ts
  common/
    bootstrap/
    filters/
    pipes/
    types/
  configs/
  integrations/
    cloudinary/
    mail/
    map/
    ollama/
    opensearch/
  modules/
    auth/
    chat/
    listing/
    notification/
    review/
    user/
  prisma/
  redis/
prisma/
  migrations/
  schema.prisma
  seed.ts
test/
  app.e2e-spec.ts
  jest-e2e.json
Dockerfile
entrypoint.sh
package.json
README.md
```

## Environment Variables
Use placeholders only. Do not commit real secrets.

```env
DATABASE_URL="postgresql://user:password@host:5432/database"
JWT_SECRET_KEY="your_jwt_secret_key"
PORT=3000
NODE_ENV="development"
UTC_OFFSET=0
CORS_ORIGIN="http://localhost:5173"
CORS_CREDENTIALS="false"

UPSTASH_REDIS_REST_URL="https://example.com"
UPSTASH_REDIS_REST_TOKEN="your_upstash_token"

SMTP_HOST="smtp.example.com"
SMTP_PORT=465
SMTP_USER="your_email@example.com"
SMTP_PASS="your_app_password"
SMTP_SECURE="true"
SMTP_FROM="noreply@example.com"

FRONTEND_URL="http://localhost:5173"
AUTH0_DOMAIN="your-auth0-domain"

OPENSEARCH_NODE="http://localhost:9200"
OPENSEARCH_USERNAME="admin"
OPENSEARCH_PASSWORD="your_opensearch_password"
OPENSEARCH_SSL="false"

CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"

OLLAMA_HOST="https://ollama.com"
OLLAMA_API_KEY="your_ollama_api_key"
OLLAMA_MODEL="gpt-oss:120b-cloud"

PEXELS_API_KEY="your_pexels_api_key"
```

Note: `src/integrations/ollama` uses the `OLLAMA_*` variables. The existing `.env.example` also contains `AI_PROVIDER` and `OPENAI_API_KEY`, but the current implementation is wired to Ollama.

## Installation
```bash
npm install
```

## Database Setup
```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

`npm install` also runs `prisma generate` through the `postinstall` script.

## Running the App
```bash
npm run start:dev
npm run start
npm run start:prod
```

## Running Tests
```bash
npm run test
npm run test:watch
npm run test:cov
```

## Docker Usage
The repository includes a `Dockerfile` and `entrypoint.sh`, but no `docker-compose.yml`.

```bash
docker build -t accommodation-finder-api .
docker run --rm -p 3000:3000 --env-file .env accommodation-finder-api
```

## OpenSearch Setup
OpenSearch is used for indexing and search across listings, users, and chat messages. It should stay private on the same host as the backend.

```text
Frontend
  ↓
Backend API
  ↓
OpenSearch private on localhost:9200
```

- The backend reads OpenSearch settings from environment variables.
- The OpenSearch API should not be exposed publicly.
- If you need OpenSearch Dashboards, expose them separately through Nginx with HTTPS and Basic Auth.
- The service falls back to PostgreSQL when OpenSearch is unavailable in parts of the application.

## Deployment
For a DigitalOcean Droplet deployment:

- Run the backend on the Droplet.
- Run OpenSearch on the same Droplet.
- Connect the backend to OpenSearch through `localhost` when both run on the host network.
- Use `host.docker.internal` or an equivalent host alias if the backend runs in Docker and OpenSearch stays on the host.
- Expose the backend domain through Nginx.
- Keep port `9200` private and do not expose OpenSearch publicly.
- Apply database migrations with `npx prisma migrate deploy` before switching traffic.

## API Documentation
Swagger/OpenAPI is available at `/api/docs`.

## Useful Commands
```bash
npm run build
npm run start:dev
npm run test
npm run lint
npm run format
npx prisma migrate dev
npx prisma db seed
```

## Notes for Developers
- Keep `.env` out of Git.
- Do not expose OpenSearch publicly.
- Update seed data carefully; it fetches images from Pexels when `PEXELS_API_KEY` is set and falls back to placeholder image URLs otherwise.
- Run `npm run lint` and `npm run build` before deployment.

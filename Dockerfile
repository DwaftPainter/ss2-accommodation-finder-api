# Base image - Node 22 is required by the current Prisma toolchain
FROM node:22-alpine

WORKDIR /usr/src/app

# Copy dependency manifests first to maximize Docker layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate the Prisma client
RUN npm ci

# Copy the application source
COPY . .

# Build the NestJS application
RUN npm run build

# Copy the startup script and make it executable
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/src/app/entrypoint.sh"]

# Base image - Using Node 22 to satisfy @prisma/streams-local requirements
FROM node:22-alpine

# Create app directory
WORKDIR /usr/src/app

# Install netcat for wait-for-db script
RUN apk add --no-cache netcat-openbsd

# Copy package files
COPY package*.json ./

# Copy prisma schema before npm install so postinstall 'prisma generate' works
COPY prisma ./prisma/

# Install dependencies (runs 'prisma generate' in postinstall)
RUN npm install

# Copy source code
COPY . .

# Re-run prisma generate just in case (optional, but ensures client is up to date with any local changes)
RUN npx prisma generate

# Build the app
RUN npm run build

# Copy entrypoint script and ensure it is executable
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Expose port
EXPOSE 3000

# Use entrypoint script
ENTRYPOINT ["./entrypoint.sh"]

export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),

  database: {
    url: process.env.DATABASE_URL,
  },

  app: {
    utcOffset: parseInt(process.env.UTC_OFFSET ?? '0', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  mail: {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '465', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? 'noreply@accommodationfinder.com',
  },

  jwt: {
    secret: process.env.JWT_SECRET_KEY ?? 'fallback-secret',
    expiresIn: '7d',
  },

  auth0: {
    domain: process.env.AUTH0_DOMAIN,
  },

  ollama: {
    host: process.env.OLLAMA_HOST ?? 'https://ollama.com',
    apiKey: process.env.OLLAMA_API_KEY,
    model: process.env.OLLAMA_MODEL ?? 'gpt-oss:120b-cloud',
  },

  opensearch: {
    node: process.env.OPENSEARCH_NODE ?? 'http://opensearch:9200',
    username: process.env.OPENSEARCH_USERNAME ?? 'admin',
    password: process.env.OPENSEARCH_PASSWORD ?? 'admin',
    ssl: process.env.OPENSEARCH_SSL === 'true',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
});

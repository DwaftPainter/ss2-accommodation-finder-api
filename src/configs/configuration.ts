export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),

  database: {
    url: process.env.DATABASE_URL,
  },

  app: {
    utcOffset: parseInt(process.env.UTC_OFFSET ?? '0', 10),
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
});

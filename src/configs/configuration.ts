export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),

  database: {
    url: process.env.DATABASE_URL!,
  },

  app: {
    utcOffset: parseInt(process.env.UTC_OFFSET ?? '0', 10),
  },
});

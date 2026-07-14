// Development runtime profile — applied when NODE_ENV=development

export interface ProfileConfig {
  cors: {
    allowedOrigins: string[]
  }
  logging: {
    slowRequestMs: number
    slowQueryMs:   number
    errorQueryMs:  number
  }
  cache: {
    ttlMs: number
  }
}

export const developmentProfile: ProfileConfig = {
  cors: {
    allowedOrigins: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ],
  },
  logging: {
    slowRequestMs: 800,
    slowQueryMs:   300,
    errorQueryMs:  1_000,
  },
  cache: {
    ttlMs: 10 * 60 * 1_000,
  },
}

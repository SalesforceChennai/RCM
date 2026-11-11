import fs from 'node:fs';
import path from 'node:path';

/**
 * Reads an environment variable from process.env or falls back to reading .env / .env.local files directly.
 */
export function getEnvVariable(key: string, defaultValue: string = ''): string {
  if (process.env[key] && process.env[key]!.trim()) {
    return process.env[key]!.trim();
  }

  try {
    const envPaths = [
      path.resolve(process.cwd(), 'server', '.env'),
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '.env.local')
    ];

    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
          const [varKey, ...rest] = trimmed.split('=');
          if (varKey.trim() === key) {
            let val = rest.join('=').trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            return val;
          }
        }
      }
    }
  } catch {
    // Ignore error reading env file
  }

  return defaultValue;
}

export const config = {
  get jwtSecretKey(): string {
    return getEnvVariable('JWT_SECRET_KEY', 'medicare-rcm-super-secure-jwt-secret-key-2026-fallback');
  },
  get jwtAlgorithm(): string {
    return getEnvVariable('JWT_ALGORITHM', 'HS256');
  },
  get jwtExpireMinutes(): number {
    const val = parseInt(getEnvVariable('JWT_EXPIRE_MINUTES', '60'), 10);
    return isNaN(val) || val <= 0 ? 60 : val;
  },
  get port(): number {
    const val = parseInt(getEnvVariable('PORT', '5000'), 10);
    return isNaN(val) || val <= 0 ? 5000 : val;
  },
  get groqApiKey(): string {
    return getEnvVariable('GROQ_API_KEY', '');
  },
  get groqModel(): string {
    return getEnvVariable('GROQ_MODEL', 'openai/gpt-oss-120b');
  },
  get databaseUrl(): string {
    return getEnvVariable('DATABASE_URL', 'postgresql://postgres:admin@localhost:5432/medicare_rcm');
  },
  get pgHost(): string {
    return getEnvVariable('PGHOST', 'localhost');
  },
  get pgPort(): number {
    const val = parseInt(getEnvVariable('PGPORT', '5432'), 10);
    return isNaN(val) ? 5432 : val;
  },
  get pgUser(): string {
    return getEnvVariable('PGUSER', 'postgres');
  },
  get pgPassword(): string {
    return getEnvVariable('PGPASSWORD', 'admin');
  },
  get pgDatabase(): string {
    return getEnvVariable('PGDATABASE', 'medicare_rcm');
  }
};

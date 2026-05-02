const required = ["DATABASE_URL", "SESSION_COOKIE_NAME", "SESSION_SECRET"] as const;

type RequiredKey = (typeof required)[number];

export function getEnv(key: RequiredKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getOptionalEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

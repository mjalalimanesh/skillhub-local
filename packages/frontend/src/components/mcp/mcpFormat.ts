const SECRET_KEY = /(token|secret|password|passwd|api[_-]?key|key|credential)/i;

export function maskEnvValue(key: string, value: string): string {
  if (SECRET_KEY.test(key)) {
    return value.length > 8
      ? `${value.slice(0, 4)}••••${value.slice(-4)}`
      : "••••••";
  }
  return value;
}

export function envEntryCount(env?: Record<string, string>): number {
  return env ? Object.keys(env).length : 0;
}

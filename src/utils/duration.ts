const UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const value = Number(match[1]);
  const unit = UNITS[match[2]!];
  if (!unit) {
    throw new Error(`Invalid duration unit: ${match[2]}`);
  }
  return value * unit;
}

export function expiresAtFromNow(duration: string): Date {
  return new Date(Date.now() + parseDurationMs(duration));
}

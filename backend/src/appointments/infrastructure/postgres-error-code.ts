function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Prisma 7's PostgreSQL adapter nests SQLSTATE under driverAdapterError.cause;
// the older raw-query shape exposes it directly. Never inspect/log error text.
export function postgresErrorCode(metadata: unknown): string | undefined {
  if (!isRecord(metadata)) return undefined;
  if (typeof metadata.code === 'string') return metadata.code;
  const adapter = metadata.driverAdapterError;
  if (!isRecord(adapter) || !isRecord(adapter.cause)) return undefined;
  const code = adapter.cause.originalCode;
  return typeof code === 'string' ? code : undefined;
}

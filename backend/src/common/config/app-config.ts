type Environment = Readonly<Record<string, string | undefined>>;
type NodeEnvironment = 'development' | 'test' | 'production';

/** Validated process configuration. Domain code never reads environment variables. */
export class AppConfig {
  private constructor(
    readonly databaseUrl: string,
    readonly port: number,
    readonly corsOrigins: string[],
    readonly nodeEnvironment: NodeEnvironment,
    readonly reviewMode: boolean,
  ) {}

  readonly clinicTimezone = 'Asia/Kolkata';

  static fromEnvironment(environment: Environment): AppConfig {
    const databaseUrl = environment.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required');
    }
    let parsedDatabaseUrl: URL;
    try {
      parsedDatabaseUrl = new URL(databaseUrl);
    } catch {
      throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
    }
    if (
      !['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol) ||
      !parsedDatabaseUrl.hostname ||
      parsedDatabaseUrl.pathname.length < 2
    ) {
      throw new Error(
        'DATABASE_URL must specify a PostgreSQL host and database',
      );
    }

    const rawPort = environment.PORT ?? '3000';
    const port = Number(rawPort);
    if (
      !/^\d+$/.test(rawPort) ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      throw new Error('PORT must be an integer between 1 and 65535');
    }

    const nodeEnvironment = environment.NODE_ENV ?? 'development';
    if (
      nodeEnvironment !== 'development' &&
      nodeEnvironment !== 'test' &&
      nodeEnvironment !== 'production'
    ) {
      throw new Error('NODE_ENV must be development, test, or production');
    }
    const rawReviewMode = environment.REVIEW_MODE ?? 'false';
    if (rawReviewMode !== 'true' && rawReviewMode !== 'false') {
      throw new Error('REVIEW_MODE must be true or false');
    }

    const corsOrigins = (
      environment.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:8080'
    )
      .split(',')
      .map((origin) => origin.trim());
    for (const origin of corsOrigins) {
      let parsedOrigin: URL;
      try {
        parsedOrigin = new URL(origin);
      } catch {
        throw new Error('CORS_ORIGINS must contain explicit HTTP(S) origins');
      }
      if (
        !['http:', 'https:'].includes(parsedOrigin.protocol) ||
        origin !== parsedOrigin.origin
      ) {
        throw new Error('CORS_ORIGINS must contain explicit HTTP(S) origins');
      }
    }

    return new AppConfig(
      databaseUrl,
      port,
      [...new Set(corsOrigins)],
      nodeEnvironment,
      rawReviewMode === 'true',
    );
  }
}

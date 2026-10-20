import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './common/config/app-config';
import { configureHttp } from './common/http/configure-http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = app.get(AppConfig);
  app.enableShutdownHooks();
  configureHttp(app);
  await app.listen(config.port, '0.0.0.0');
  process.stdout.write(
    `${JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', operation: 'startup', code: 'READY' })}\n`,
  );
}
void bootstrap().catch(() => {
  process.stderr.write(
    `${JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', operation: 'startup', code: 'STARTUP_FAILED' })}\n`,
  );
  process.exitCode = 1;
});

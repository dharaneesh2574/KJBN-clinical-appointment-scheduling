import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './common/config/app-config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfig);
  app.enableShutdownHooks();
  app.enableCors({ origin: config.corsOrigins });
  await app.listen(config.port, '0.0.0.0');
}
void bootstrap();

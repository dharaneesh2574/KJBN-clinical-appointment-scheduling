import { Global, Module } from '@nestjs/common';
import { config as loadDotenv } from 'dotenv';
import { AppConfig } from './app-config';

@Global()
@Module({
  providers: [
    {
      provide: AppConfig,
      useFactory: () => {
        // Existing process variables take precedence over backend/.env.
        loadDotenv({ quiet: true });
        return AppConfig.fromEnvironment(process.env);
      },
    },
  ],
  exports: [AppConfig],
})
export class ConfigurationModule {}

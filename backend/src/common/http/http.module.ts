import {
  CanActivate,
  ExecutionContext,
  Global,
  Injectable,
  Module,
  Scope,
} from '@nestjs/common';
import { APP_GUARD, REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { ConfigurationModule } from '../config/configuration.module';
import { AppConfig } from '../config/app-config';
import { Clock } from '../domain/clock';
import { SystemClock } from '../infrastructure/system-clock';
import { RequestContexts } from './request-context';
import { RequestLogger } from './request-logger';

@Injectable()
class RequestClockGuard implements CanActivate {
  constructor(
    private readonly contexts: RequestContexts,
    private readonly config: AppConfig,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    this.contexts.clock(
      context.switchToHttp().getRequest<Request>(),
      this.config.reviewMode,
    );
    return true;
  }
}
@Global()
@Module({
  imports: [ConfigurationModule],
  providers: [
    SystemClock,
    RequestContexts,
    RequestLogger,
    { provide: APP_GUARD, useClass: RequestClockGuard },
    {
      provide: Clock,
      scope: Scope.REQUEST,
      useFactory: (
        request: Request,
        contexts: RequestContexts,
        config: AppConfig,
      ) => contexts.clock(request, config.reviewMode),
      inject: [REQUEST, RequestContexts, AppConfig],
    },
  ],
  exports: [Clock, RequestContexts, RequestLogger],
})
export class HttpModule {}

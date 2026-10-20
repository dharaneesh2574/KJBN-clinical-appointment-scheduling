import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponse } from '../common/http/dto';
import { DatabaseReadiness } from './database-readiness';

class LivenessResponse {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';
}

class ReadinessResponse {
  @ApiProperty({ enum: ['ready'] })
  status!: 'ready';
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseReadiness) {}

  @Get('live')
  @ApiOkResponse({ type: LivenessResponse })
  live(): LivenessResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOkResponse({ type: ReadinessResponse })
  @ApiResponse({
    status: 503,
    type: ErrorResponse,
    description: 'Database unavailable',
  })
  async ready(): Promise<ReadinessResponse> {
    if (!(await this.database.isReady()))
      throw new ServiceUnavailableException({ code: 'DATABASE_UNAVAILABLE' });
    return { status: 'ready' };
  }
}

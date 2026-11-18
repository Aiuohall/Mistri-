import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

interface HealthResponse {
  status: 'ok';
  service: 'mistri-api';
  timestamp: string;
}

@ApiTags('system')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check whether the API process is running' })
  @ApiOkResponse({ description: 'The API is accepting requests.' })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'mistri-api',
      timestamp: new Date().toISOString(),
    };
  }
}

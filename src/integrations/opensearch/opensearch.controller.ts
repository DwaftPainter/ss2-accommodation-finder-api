import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OpensearchService } from './opensearch.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt.guard';

@ApiTags('OpenSearch')
@ApiBearerAuth()
@Controller('opensearch')
export class OpensearchController {
  constructor(private readonly opensearch: OpensearchService) {}

  @Get('health')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check OpenSearch health status' })
  async health() {
    const isHealthy = await this.opensearch.checkHealth();
    return {
      status: isHealthy ? 'healthy' : 'unavailable',
      available: isHealthy,
    };
  }
}

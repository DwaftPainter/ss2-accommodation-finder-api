import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpensearchService } from './opensearch.service';
import { OpensearchController } from './opensearch.controller';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [OpensearchService],
  exports: [OpensearchService],
  controllers: [OpensearchController],
})
export class OpensearchModule {}

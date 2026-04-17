import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpensearchService } from './opensearch.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [OpensearchService],
  exports: [OpensearchService],
})
export class OpensearchModule {}

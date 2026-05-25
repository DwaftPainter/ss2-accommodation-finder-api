import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { ListingsModule } from 'src/modules/listing/listings.module';
import { OpensearchModule } from '../opensearch/opensearch.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000, // Increase timeout for AI API calls
      maxRedirects: 5,
    }),
    CacheModule.register(),
    ListingsModule,
    OpensearchModule,
  ],
  controllers: [AIController],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}

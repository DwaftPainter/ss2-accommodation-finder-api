import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { ListingsModule } from 'src/modules/listing/listings.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000, // Increase timeout for AI API calls
      maxRedirects: 5,
    }),
    ListingsModule, // Import ListingsModule to access listing data
  ],
  controllers: [AIController],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
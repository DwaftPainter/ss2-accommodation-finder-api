import { Module } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { MapModule } from '../../integrations/map/map.module';
import { OpensearchModule } from '../../integrations/opensearch/opensearch.module';

@Module({
  imports: [MapModule, OpensearchModule],
  controllers: [ListingsController],
  providers: [ListingsService, PrismaService],
  exports: [ListingsService], // Export ListingsService so other modules can use it
})
export class ListingsModule {}

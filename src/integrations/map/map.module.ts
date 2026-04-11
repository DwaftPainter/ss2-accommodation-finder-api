import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MapService } from './map.service';
import { MapController } from './map.controller';

@Module({
  imports: [HttpModule],
  controllers: [MapController],
  providers: [MapService],
  exports: [MapService],
})
export class MapModule {}

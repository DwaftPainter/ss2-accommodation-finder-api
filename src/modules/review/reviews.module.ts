import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsModule } from '../notification/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, PrismaService],
})
export class ReviewsModule {}

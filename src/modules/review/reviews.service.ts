import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { NotificationsService } from '../notification/notifications.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(userId: string, data: CreateReviewDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: data.listingId },
    });

    if (!listing) {
      throw new BadRequestException('Listing not found');
    }

    if (listing.ownerId === userId) {
      throw new ForbiddenException('Cannot review your own listing');
    }

    const existing = await this.prisma.review.findUnique({
      where: {
        listingId_userId: {
          listingId: data.listingId,
          userId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('You already reviewed this listing');
    }

    const review = await this.prisma.review.create({
      data: {
        ...data,
        userId,
      },
    });

    this.notifications
      .createForUser({
        userId: listing.ownerId,
        type: 'NEW_REVIEW',
        title: 'Đánh giá mới',
        body: `Tin "${listing.title}" vừa có đánh giá ${data.rating} sao.`,
        refId: listing.id,
      })
      .catch((error) =>
        this.logger.warn(
          `Failed to create review notification: ${error.message}`,
        ),
      );

    return review;
  }

  async getByListing(listingId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { listingId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate Average Rating
    const avg =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return {
      data: reviews,
      meta: {
        total: reviews.length,
        averageRating: Number(avg.toFixed(1)),
      },
    };
  }

  async update(userId: string, reviewId: string, data: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review || review.userId !== userId) {
      throw new ForbiddenException();
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data,
    });
  }

  async delete(userId: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review || review.userId !== userId) {
      throw new ForbiddenException();
    }

    return this.prisma.review.delete({
      where: { id: reviewId },
    });
  }
}

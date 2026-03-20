import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: any) {
    // Prevent to review by my ownÏ
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

    return this.prisma.review.create({
      data: {
        ...data,
        userId,
      },
    });
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

  async update(userId: string, reviewId: string, data: any) {
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

import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../prisma/prisma.service';
import { prismaMock } from '../../../test/mocks/prisma.mock';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      listingId: 'listing-1',
      rating: 5,
      content: 'Great place!',
    };

    it('should create review', async () => {
      const mockReview = {
        id: 'review-1',
        ...createDto,
        userId: 'user-1',
      };

      prismaMock.listing.findUnique.mockResolvedValue({
        ownerId: 'user-2',
      });
      prismaMock.review.findUnique.mockResolvedValue(null);
      prismaMock.review.create.mockResolvedValue(mockReview);

      const result = await service.create('user-1', createDto);

      expect(prismaMock.listing.findUnique).toHaveBeenCalledWith({
        where: { id: 'listing-1' },
      });
      expect(prismaMock.review.findUnique).toHaveBeenCalledWith({
        where: {
          listingId_userId: {
            listingId: 'listing-1',
            userId: 'user-1',
          },
        },
      });
      expect(prismaMock.review.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          userId: 'user-1',
        },
      });
      expect(result).toEqual(mockReview);
    });

    it('should throw BadRequestException if listing not found', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if reviewing own listing', async () => {
      prismaMock.listing.findUnique.mockResolvedValue({
        ownerId: 'user-1',
      });

      await expect(service.create('user-1', createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if duplicate review', async () => {
      prismaMock.listing.findUnique.mockResolvedValue({
        ownerId: 'user-2',
      });
      prismaMock.review.findUnique.mockResolvedValue({
        id: 'existing-review',
      });

      await expect(service.create('user-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create review with minimal data (no content)', async () => {
      const minimalDto = {
        listingId: 'listing-1',
        rating: 4,
      };
      const mockReview = {
        id: 'review-1',
        ...minimalDto,
        userId: 'user-1',
      };

      prismaMock.listing.findUnique.mockResolvedValue({
        ownerId: 'user-2',
      });
      prismaMock.review.findUnique.mockResolvedValue(null);
      prismaMock.review.create.mockResolvedValue(mockReview);

      await service.create('user-1', minimalDto);

      expect(prismaMock.review.create).toHaveBeenCalledWith({
        data: {
          ...minimalDto,
          userId: 'user-1',
        },
      });
    });
  });

  describe('getByListing', () => {
    it('should return reviews with average rating', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          content: 'Great!',
          user: { id: 'user-1', name: 'User 1', avatarUrl: null },
          createdAt: new Date(),
        },
        {
          id: 'review-2',
          rating: 4,
          content: 'Good',
          user: { id: 'user-2', name: 'User 2', avatarUrl: null },
          createdAt: new Date(),
        },
      ];

      prismaMock.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getByListing('listing-1');

      expect(prismaMock.review.findMany).toHaveBeenCalledWith({
        where: { listingId: 'listing-1' },
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
      expect(result.data).toEqual(mockReviews);
      expect(result.meta.total).toBe(2);
      expect(result.meta.averageRating).toBe(4.5);
    });

    it('should return 0 average when no reviews', async () => {
      prismaMock.review.findMany.mockResolvedValue([]);

      const result = await service.getByListing('listing-1');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.averageRating).toBe(0);
    });

    it('should calculate average rating correctly', async () => {
      const mockReviews = [
        { rating: 5, user: { id: 'u1', name: 'U1', avatarUrl: null } },
        { rating: 3, user: { id: 'u2', name: 'U2', avatarUrl: null } },
        { rating: 4, user: { id: 'u3', name: 'U3', avatarUrl: null } },
      ];

      prismaMock.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getByListing('listing-1');

      expect(result.meta.averageRating).toBe(4.0); // (5+3+4)/3 = 4.0
    });

    it('should round average rating to 1 decimal', async () => {
      const mockReviews = [
        { rating: 5, user: { id: 'u1', name: 'U1', avatarUrl: null } },
        { rating: 4, user: { id: 'u2', name: 'U2', avatarUrl: null } },
        { rating: 4, user: { id: 'u3', name: 'U3', avatarUrl: null } },
      ];

      prismaMock.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getByListing('listing-1');

      // (5+4+4)/3 = 4.333... should round to 4.3
      expect(result.meta.averageRating).toBe(4.3);
    });
  });

  describe('update', () => {
    const updateDto = {
      rating: 4,
      content: 'Updated review',
    };

    it('should update review if owner', async () => {
      const mockReview = {
        id: 'review-1',
        ...updateDto,
        userId: 'user-1',
      };

      prismaMock.review.findUnique.mockResolvedValue({ userId: 'user-1' });
      prismaMock.review.update.mockResolvedValue(mockReview);

      const result = await service.update('user-1', 'review-1', updateDto);

      expect(prismaMock.review.findUnique).toHaveBeenCalledWith({
        where: { id: 'review-1' },
      });
      expect(prismaMock.review.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: updateDto,
      });
      expect(result).toEqual(mockReview);
    });

    it('should throw ForbiddenException if not owner', async () => {
      prismaMock.review.findUnique.mockResolvedValue({ userId: 'user-2' });

      await expect(
        service.update('user-1', 'review-1', updateDto),
      ).rejects.toThrow(ForbiddenException);

      expect(prismaMock.review.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if review not found', async () => {
      prismaMock.review.findUnique.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'review-1', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update with partial data', async () => {
      const partialUpdate = { content: 'Only updating content' };
      const mockReview = {
        id: 'review-1',
        ...partialUpdate,
        rating: 5,
        userId: 'user-1',
      };

      prismaMock.review.findUnique.mockResolvedValue({ userId: 'user-1' });
      prismaMock.review.update.mockResolvedValue(mockReview);

      await service.update('user-1', 'review-1', partialUpdate);

      expect(prismaMock.review.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: partialUpdate,
      });
    });
  });

  describe('delete', () => {
    it('should delete review if owner', async () => {
      const mockReview = {
        id: 'review-1',
        rating: 5,
        userId: 'user-1',
      };

      prismaMock.review.findUnique.mockResolvedValue({ userId: 'user-1' });
      prismaMock.review.delete.mockResolvedValue(mockReview);

      const result = await service.delete('user-1', 'review-1');

      expect(prismaMock.review.findUnique).toHaveBeenCalledWith({
        where: { id: 'review-1' },
      });
      expect(prismaMock.review.delete).toHaveBeenCalledWith({
        where: { id: 'review-1' },
      });
      expect(result).toEqual(mockReview);
    });

    it('should throw ForbiddenException if not owner', async () => {
      prismaMock.review.findUnique.mockResolvedValue({ userId: 'user-2' });

      await expect(service.delete('user-1', 'review-1')).rejects.toThrow(
        ForbiddenException,
      );

      expect(prismaMock.review.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if review not found', async () => {
      prismaMock.review.findUnique.mockResolvedValue(null);

      await expect(service.delete('user-1', 'review-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

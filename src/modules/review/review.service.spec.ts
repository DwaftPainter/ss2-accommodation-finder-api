import { Test } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../prisma/prisma.service';
import { prismaMock } from '../../../test/mocks/prisma.mock';

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(ReviewsService);
  });

  it('should create review', async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      ownerId: 'other',
    });

    prismaMock.review.findUnique.mockResolvedValue(null);

    prismaMock.review.create.mockResolvedValue({
      id: '1',
      rating: 5,
    });

    const result = await service.create('user1', {
      listingId: 'listing1',
      rating: 5,
    });

    expect(result.rating).toBe(5);
  });

  it('should not allow duplicate review', async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      ownerId: 'other',
    });

    prismaMock.review.findUnique.mockResolvedValue({
      id: '1',
    });

    await expect(
      service.create('user1', {
        listingId: 'listing1',
        rating: 5,
      }),
    ).rejects.toThrow();
  });
});

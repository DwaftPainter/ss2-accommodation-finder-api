import { prismaMock } from '../../../test/mocks/prisma.mock';
import { PrismaService } from '../../prisma/prisma.service';
import { ListingsService } from './listings.service';
import { Test } from '@nestjs/testing';

describe('ListingsService', () => {
  let service: ListingsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(ListingsService);
  });

  it('should create listing', async () => {
    prismaMock.listing.create.mockResolvedValue({
      id: '1',
      title: 'Room',
    });

    const result = await service.create(
      'user1',

      {
        title: 'Phòng trọ Quận 1',
        address: '123 Nguyễn Trãi, Q1',
        lat: 10.762622,
        lng: 106.660172,
        price: 5000000,
        area: 25,
        electricityFee: 3500,
        waterFee: 15000,
        description: 'Phòng đẹp, gần trung tâm',
        utilities: ['wifi', 'parking', 'air_conditioning'],
        images: [
          'https://example.com/img1.jpg',
          'https://example.com/img2.jpg',
        ],
        contactName: 'Chủ trọ',
        contactPhone: '0901234567',
      },
    );

    expect(result.title).toBe('Room');
  });

  it('should forbid update if not owner', async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      ownerId: 'other',
    });

    await expect(
      service.update(
        'user1',
        'listing1',

        {
          title: 'Phòng trọ Quận 1',
          address: '123 Nguyễn Trãi, Q1',
          lat: 10.762622,
          lng: 106.660172,
          price: 5000000,
          area: 25,
          electricityFee: 3500,
          waterFee: 15000,
          description: 'Phòng đẹp, gần trung tâm',
          utilities: ['wifi', 'parking', 'air_conditioning'],
          images: [
            'https://example.com/img1.jpg',
            'https://example.com/img2.jpg',
          ],
          contactName: 'Chủ trọ',
          contactPhone: '0901234567',
        },
      ),
    ).rejects.toThrow();
  });

  it('should return paginated listings', async () => {
    prismaMock.listing.findMany.mockResolvedValue([]);
    prismaMock.listing.count.mockResolvedValue(0);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(result.meta.total).toBe(0);
  });
});

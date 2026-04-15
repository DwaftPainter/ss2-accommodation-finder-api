import { Test, TestingModule } from '@nestjs/testing';
import { ListingsService } from './listings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MapService } from '../../integrations/map/map.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { prismaMock } from '../../../test/mocks/prisma.mock';

describe('ListingsService', () => {
  let service: ListingsService;
  let mapService: jest.Mocked<MapService>;

  const mockMapService = {
    geocode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MapService, useValue: mockMapService },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
    mapService = module.get(MapService) as jest.Mocked<MapService>;
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      title: 'Phòng trọ Quận 1',
      address: '123 Nguyễn Trãi, Q1',
      lat: 10.762622,
      lng: 106.660172,
      price: 5000000,
      area: 25,
      electricityFee: 3500,
      waterFee: 15000,
      description: 'Phòng đẹp, gần trung tâm',
      utilities: ['wifi', 'parking'],
      images: ['https://example.com/img1.jpg'],
      contactName: 'Chủ trọ',
      contactPhone: '0901234567',
    };

    it('should create listing', async () => {
      const mockListing = {
        id: '1',
        title: 'Room',
        ...createDto,
        ownerId: 'user1',
      };
      prismaMock.listing.create.mockResolvedValue(mockListing);

      const result = await service.create('user1', createDto);

      expect(prismaMock.listing.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          ownerId: 'user1',
        },
      });
      expect(result).toEqual(mockListing);
    });

    it('should create listing with minimal data', async () => {
      const minimalDto = {
        title: 'Simple Room',
        address: '456 Street',
        lat: 10.0,
        lng: 106.0,
        price: 3000000,
        area: 20,
      };
      const mockListing = {
        id: '1',
        ...minimalDto,
        ownerId: 'user1',
      };
      prismaMock.listing.create.mockResolvedValue(mockListing);

      const result = await service.create('user1', minimalDto as any);

      expect(result).toEqual(mockListing);
    });
  });

  describe('findAll', () => {
    const mockListings = [
      {
        id: '1',
        title: 'Room 1',
        price: 5000000,
        owner: { id: 'user1', name: 'Owner', avatarUrl: null },
      },
      {
        id: '2',
        title: 'Room 2',
        price: 6000000,
        owner: { id: 'user2', name: 'Owner 2', avatarUrl: null },
      },
    ];

    it('should return paginated listings', async () => {
      prismaMock.listing.findMany.mockResolvedValue(mockListings);
      prismaMock.listing.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(prismaMock.listing.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        skip: 0,
        take: 10,
        include: {
          owner: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result.data).toEqual(mockListings);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
      });
    });

    it('should filter by minPrice', async () => {
      prismaMock.listing.findMany.mockResolvedValue([]);
      prismaMock.listing.count.mockResolvedValue(0);

      await service.findAll({ minPrice: 5000000 });

      expect(prismaMock.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ price: { gte: 5000000 } }]),
          }),
        }),
      );
    });

    it('should filter by maxPrice', async () => {
      prismaMock.listing.findMany.mockResolvedValue([]);
      prismaMock.listing.count.mockResolvedValue(0);

      await service.findAll({ maxPrice: 10000000 });

      expect(prismaMock.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ price: { lte: 10000000 } }]),
          }),
        }),
      );
    });

    it('should filter by minArea and maxArea', async () => {
      prismaMock.listing.findMany.mockResolvedValue([]);
      prismaMock.listing.count.mockResolvedValue(0);

      await service.findAll({ minArea: 20, maxArea: 50 });

      expect(prismaMock.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { area: { gte: 20 } },
              { area: { lte: 50 } },
            ]),
          }),
        }),
      );
    });

    it('should filter by utilities', async () => {
      prismaMock.listing.findMany.mockResolvedValue([]);
      prismaMock.listing.count.mockResolvedValue(0);

      await service.findAll({ utilities: 'wifi,parking' });

      expect(prismaMock.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                utilities: {
                  hasSome: ['wifi', 'parking'],
                },
              },
            ]),
          }),
        }),
      );
    });

    it('should calculate skip correctly for pagination', async () => {
      prismaMock.listing.findMany.mockResolvedValue([]);
      prismaMock.listing.count.mockResolvedValue(0);

      await service.findAll({ page: 3, limit: 10 });

      expect(prismaMock.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should use default pagination values', async () => {
      prismaMock.listing.findMany.mockResolvedValue([]);
      prismaMock.listing.count.mockResolvedValue(0);

      await service.findAll({});

      expect(prismaMock.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single listing', async () => {
      const mockListing = {
        id: '1',
        title: 'Room',
        owner: { id: 'user1', name: 'Owner' },
        reviews: [],
      };
      prismaMock.listing.findUnique.mockResolvedValue(mockListing);

      const result = await service.findOne('1');

      expect(prismaMock.listing.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          owner: true,
          reviews: true,
        },
      });
      expect(result).toEqual(mockListing);
    });

    it('should return null if listing not found', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const updateDto: any = {
      title: 'Updated Title',
      price: 6000000,
    };

    it('should update listing if owner', async () => {
      const mockListing = {
        id: '1',
        ownerId: 'user1',
        ...updateDto,
      };
      prismaMock.listing.findUnique.mockResolvedValue({ ownerId: 'user1' });
      prismaMock.listing.update.mockResolvedValue(mockListing);

      const result = await service.update('user1', '1', updateDto);

      expect(prismaMock.listing.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(prismaMock.listing.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateDto,
      });
      expect(result).toEqual(mockListing);
    });

    it('should throw ForbiddenException if not owner', async () => {
      prismaMock.listing.findUnique.mockResolvedValue({ ownerId: 'user2' });

      await expect(
        service.update('user1', '1', updateDto),
      ).rejects.toThrow(ForbiddenException);

      expect(prismaMock.listing.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if listing not found', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);

      await expect(
        service.update('user1', '1', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update listing with partial data', async () => {
      const partialUpdate: any = { title: 'New Title Only' };
      const mockListing = {
        id: '1',
        ownerId: 'user1',
        title: 'New Title Only',
      };
      prismaMock.listing.findUnique.mockResolvedValue({ ownerId: 'user1' });
      prismaMock.listing.update.mockResolvedValue(mockListing);

      await service.update('user1', '1', partialUpdate);

      expect(prismaMock.listing.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: partialUpdate,
      });
    });
  });

  describe('remove', () => {
    it('should delete listing if owner', async () => {
      const mockListing = {
        id: '1',
        ownerId: 'user1',
        title: 'Room',
      };
      prismaMock.listing.findUnique.mockResolvedValue({ ownerId: 'user1' });
      prismaMock.listing.delete.mockResolvedValue(mockListing);

      const result = await service.remove('user1', '1');

      expect(prismaMock.listing.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(prismaMock.listing.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toEqual(mockListing);
    });

    it('should throw ForbiddenException if not owner', async () => {
      prismaMock.listing.findUnique.mockResolvedValue({ ownerId: 'user2' });

      await expect(service.remove('user1', '1')).rejects.toThrow(
        ForbiddenException,
      );

      expect(prismaMock.listing.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if listing not found', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);

      await expect(service.remove('user1', '1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getMyListings', () => {
    it('should return user listings', async () => {
      const mockListings = [
        { id: '1', title: 'Room 1', ownerId: 'user1' },
        { id: '2', title: 'Room 2', ownerId: 'user1' },
      ];
      prismaMock.listing.findMany.mockResolvedValue(mockListings);

      const result = await service.getMyListings('user1');

      expect(prismaMock.listing.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'user1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockListings);
    });

    it('should return empty array if user has no listings', async () => {
      prismaMock.listing.findMany.mockResolvedValue([]);

      const result = await service.getMyListings('user1');

      expect(result).toEqual([]);
    });
  });

  describe('geocodeAddress', () => {
    it('should geocode address using map service', async () => {
      const mockGeocodeResult = {
        lat: 10.762622,
        lng: 106.660172,
        formattedAddress: '123 Nguyen Trai, District 1',
        displayName: '123 Nguyen Trai, District 1, Ho Chi Minh City',
        raw: {},
      };
      mapService.geocode.mockResolvedValue(mockGeocodeResult);

      const result = await service.geocodeAddress('123 Nguyen Trai');

      expect(mapService.geocode).toHaveBeenCalledWith({
        address: '123 Nguyen Trai',
      });
      expect(result).toEqual(mockGeocodeResult);
    });

    it('should propagate errors from map service', async () => {
      mapService.geocode.mockRejectedValue(new Error('Geocoding failed'));

      await expect(service.geocodeAddress('Invalid')).rejects.toThrow(
        'Geocoding failed',
      );
    });
  });

  describe('findNearby', () => {
    it('should find listings near coordinates', async () => {
      const mockListings = [
        { id: '1', title: 'Room 1', lat: 10.762, lng: 106.660, distance: 0.1 },
        { id: '2', title: 'Room 2', lat: 10.763, lng: 106.661, distance: 0.5 },
      ];
      prismaMock.$queryRaw.mockResolvedValue(mockListings);

      const result = await service.findNearby(10.762622, 106.660172, 5, 10);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockListings);
    });

    it('should use default radius and limit', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      await service.findNearby(10.762622, 106.660172);

      // Verify that queryRaw was called with the raw query containing defaults
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      const queryTemplate = prismaMock.$queryRaw.mock.calls[0][0];
      expect(typeof queryTemplate).toBe('object');
    });

    it('should handle empty results', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      const result = await service.findNearby(10.0, 106.0, 1, 10);

      expect(result).toEqual([]);
    });
  });

  describe('searchByAddress', () => {
    it('should search listings by address', async () => {
      const mockGeocodeResult = {
        lat: 10.762622,
        lng: 106.660172,
        formattedAddress: 'District 1, Ho Chi Minh City',
        displayName: 'District 1',
        raw: {},
      };
      const mockListings = [
        { id: '1', title: 'Room in District 1', distance: 0.5 },
      ];

      mapService.geocode.mockResolvedValue(mockGeocodeResult);
      prismaMock.$queryRaw.mockResolvedValue(mockListings);

      const result = await service.searchByAddress('District 1', 5);

      expect(mapService.geocode).toHaveBeenCalledWith({ address: 'District 1' });
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual({
        location: mockGeocodeResult,
        listings: mockListings,
      });
    });

    it('should use default radius', async () => {
      mapService.geocode.mockResolvedValue({
        lat: 10.0,
        lng: 106.0,
        formattedAddress: 'Test',
        displayName: 'Test',
        raw: {},
      });
      prismaMock.$queryRaw.mockResolvedValue([]);

      await service.searchByAddress('Test Address');

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });

    it('should throw NotFoundException when address not found', async () => {
      mapService.geocode.mockResolvedValue(null);

      await expect(service.searchByAddress('Invalid Address')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

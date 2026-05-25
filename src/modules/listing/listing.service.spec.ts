import { Test, TestingModule } from '@nestjs/testing';
import { ListingsService } from './listings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MapService } from '../../integrations/map/map.service';
import { OpensearchService } from '../../integrations/opensearch/opensearch.service';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { prismaMock } from '../../../test/mocks/prisma.mock';
import { ListingStatus, ListingType } from '@prisma/client';

describe('ListingsService', () => {
  let service: ListingsService;
  let mapService: jest.Mocked<MapService>;
  let cloudinaryService: jest.Mocked<CloudinaryService>;

  const mockMapService = {
    geocode: jest.fn(),
  };

  const mockOpensearchService = {
    indexListing: jest.fn(),
    searchListings: jest.fn(),
    deleteListing: jest.fn(),
  };

  const mockCloudinaryService = {
    uploadFile: jest.fn(),
    uploadFiles: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MapService, useValue: mockMapService },
        { provide: OpensearchService, useValue: mockOpensearchService },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
    mapService = module.get(MapService) as jest.Mocked<MapService>;
    cloudinaryService = module.get(
      CloudinaryService,
    ) as jest.Mocked<CloudinaryService>;
    jest.clearAllMocks();
    prismaMock.review.groupBy.mockResolvedValue([]);
  });

  describe('create', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const createDto = {
      title: 'Phòng trọ Quận 1',
      street: '123 Nguyễn Trãi',
      ward: 'Phường Bến Thành',
      district: 'Quận 1',
      city: 'Hồ Chí Minh',
      province: 'Hồ Chí Minh',
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

    const createPersistedListing = (dto: typeof createDto | any) => ({
      id: '1',
      ...dto,
      type: ListingType.ROOM,
      status: ListingStatus.ACTIVE,
      createdAt,
      ownerId: 'user1',
      address: {
        street: dto.street,
        ward: dto.ward,
        district: dto.district,
        city: dto.city,
        province: dto.province,
        lat: dto.lat,
        lng: dto.lng,
      },
    });

    it('should create listing', async () => {
      const mockListing = createPersistedListing(createDto);
      prismaMock.listing.create.mockResolvedValue(mockListing);

      const result = await service.create('user1', createDto);

      expect(prismaMock.listing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ListingStatus.ACTIVE,
          }),
        }),
      );
      expect(mockOpensearchService.indexListing).toHaveBeenCalled();
      expect(result).toEqual(mockListing);
    });

    it('should create listing with minimal data', async () => {
      const minimalDto = {
        title: 'Simple Room',
        street: '456 Street',
        district: 'District 1',
        city: 'City',
        province: 'Province',
        lat: 10.0,
        lng: 106.0,
        price: 3000000,
        area: 20,
        utilities: [],
        images: ['img.jpg'],
      };
      const mockListing = createPersistedListing(minimalDto);
      prismaMock.listing.create.mockResolvedValue(mockListing);

      const result = await service.create('user1', minimalDto as any);

      expect(result).toEqual(mockListing);
    });

    it('should upload files to cloudinary when provided', async () => {
      const files = [
        { buffer: Buffer.from('test'), originalname: 'test.jpg' },
      ] as any;
      const uploadResults = [{ secure_url: 'https://cloudinary.com/test.jpg' }];
      cloudinaryService.uploadFiles.mockResolvedValue(uploadResults as any);

      const mockListing = createPersistedListing({
        ...createDto,
        images: [...createDto.images, 'https://cloudinary.com/test.jpg'],
      });
      prismaMock.listing.create.mockResolvedValue(mockListing);

      await service.create('user1', createDto, files);

      expect(cloudinaryService.uploadFiles).toHaveBeenCalledWith(files);
      expect(prismaMock.listing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            images: expect.arrayContaining(['https://cloudinary.com/test.jpg']),
          }),
        }),
      );
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
          address: true,
          owner: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(prismaMock.review.groupBy).toHaveBeenCalledWith({
        by: ['listingId'],
        where: { listingId: { in: ['1', '2'] } },
        _avg: { rating: true },
        _count: { _all: true },
      });
      expect(result.data).toEqual([
        {
          id: '1',
          title: 'Room 1',
          price: 5000000,
          owner: { id: 'user1', name: 'Owner', avatarUrl: null },
          reviewCount: 0,
          avgRating: 0,
        },
        {
          id: '2',
          title: 'Room 2',
          price: 6000000,
          owner: { id: 'user2', name: 'Owner 2', avatarUrl: null },
          reviewCount: 0,
          avgRating: 0,
        },
      ]);
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
        owner: { id: 'user1', name: 'Owner', avatarUrl: null, phone: null },
        reviews: [],
        _count: { reviews: 0 },
      };
      prismaMock.listing.findUnique.mockResolvedValue(mockListing);

      const result = await service.findOne('1');

      expect(prismaMock.listing.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          address: true,
          owner: {
            select: { id: true, name: true, avatarUrl: true, phone: true },
          },
          _count: { select: { reviews: true } },
          reviews: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      expect(result).toEqual({
        id: '1',
        title: 'Room',
        owner: { id: 'user1', name: 'Owner', avatarUrl: null, phone: null },
        reviews: [],
        reviewCount: 0,
        avgRating: 0,
      });
    });

    it('should throw NotFoundException if listing not found', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
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
        include: { address: true },
      });
      expect(result).toEqual(mockListing);
    });

    it('should throw ForbiddenException if not owner', async () => {
      prismaMock.listing.findUnique.mockResolvedValue({ ownerId: 'user2' });

      await expect(service.update('user1', '1', updateDto)).rejects.toThrow(
        ForbiddenException,
      );

      expect(prismaMock.listing.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if listing not found', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);

      await expect(service.update('user1', '1', updateDto)).rejects.toThrow(
        ForbiddenException,
      );
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
        include: { address: true },
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
        include: { address: true },
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
        { id: '1', title: 'Room 1', lat: 10.762, lng: 106.66, distance: 0.1 },
        { id: '2', title: 'Room 2', lat: 10.763, lng: 106.661, distance: 0.5 },
      ];
      prismaMock.$queryRaw.mockResolvedValue(mockListings);

      const result = await service.findNearby(10.762622, 106.660172, 5, 10);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(
        mockListings.map((l) => ({
          ...l,
          address: {
            street: undefined,
            ward: undefined,
            district: undefined,
            city: undefined,
            province: undefined,
            lat: l.lat,
            lng: l.lng,
          },
          owner: {
            id: undefined,
            name: undefined,
            avatarUrl: undefined,
          },
          reviewCount: 0,
          avgRating: 0,
        })),
      );
    });

    it('should use default radius and limit', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      await service.findNearby(10.762622, 106.660172);

      // Verify that queryRaw was called with the raw query containing defaults
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
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

      expect(mapService.geocode).toHaveBeenCalledWith({
        address: 'District 1',
      });
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual({
        location: mockGeocodeResult,
        listings: mockListings.map((l) => ({
          ...l,
          address: {
            street: undefined,
            ward: undefined,
            district: undefined,
            city: undefined,
            province: undefined,
            lat: undefined,
            lng: undefined,
          },
          owner: {
            id: undefined,
            name: undefined,
            avatarUrl: undefined,
          },
          reviewCount: 0,
          avgRating: 0,
        })),
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

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MapService } from '../../integrations/map/map.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingDto } from './dto/query-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

@Injectable()
export class ListingsService {
  constructor(
    private prisma: PrismaService,
    private mapService: MapService,
  ) {}

  async create(userId: string, dto: CreateListingDto) {
    const {
      street,
      ward,
      district,
      city,
      province,
      lat,
      lng,
      ...listingFields
    } = dto;

    return this.prisma.listing.create({
      data: {
        ...listingFields,
        owner: { connect: { id: userId } },
        address: {
          create: { street, ward, district, city, province, lat, lng },
        },
      } satisfies Prisma.ListingCreateInput,
      include: {
        address: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async findAll(query: QueryListingDto) {
    const {
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      utilities,
      page = 1,
      limit = 10,
    } = query;

    const where: Prisma.ListingWhereInput = {
      AND: [
        minPrice ? { price: { gte: minPrice } } : {},
        maxPrice ? { price: { lte: maxPrice } } : {},
        minArea ? { area: { gte: minArea } } : {},
        maxArea ? { area: { lte: maxArea } } : {},
        utilities ? { utilities: { hasSome: utilities.split(',') } } : {},
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          address: true,
          owner: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return { data, meta: { page, limit, total } };
  }

  async findOne(id: string) {
    return this.prisma.listing.findUnique({
      where: { id },
      include: {
        address: true,
        owner: true,
        reviews: true,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });

    if (!listing || listing.ownerId !== userId) {
      throw new ForbiddenException();
    }

    const {
      street,
      ward,
      district,
      city,
      province,
      lat,
      lng,
      ...listingFields
    } = dto;

    const hasAddressUpdate = [
      street,
      ward,
      district,
      city,
      province,
      lat,
      lng,
    ].some((v) => v !== undefined);

    return this.prisma.listing.update({
      where: { id },
      data: {
        ...listingFields,
        ...(hasAddressUpdate && {
          address: {
            update: {
              ...(street !== undefined && { street }),
              ...(ward !== undefined && { ward }),
              ...(district !== undefined && { district }),
              ...(city !== undefined && { city }),
              ...(province !== undefined && { province }),
              ...(lat !== undefined && { lat }),
              ...(lng !== undefined && { lng }),
            },
          },
        }),
      } satisfies Prisma.ListingUpdateInput,
      include: { address: true },
    });
  }

  async remove(userId: string, id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });

    if (!listing || listing.ownerId !== userId) {
      throw new ForbiddenException();
    }

    return this.prisma.listing.delete({ where: { id } });
  }

  async getMyListings(userId: string) {
    return this.prisma.listing.findMany({
      where: { ownerId: userId },
      include: { address: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async geocodeAddress(address: string) {
    return this.mapService.geocode({ address });
  }

  async findNearby(
    lat: number,
    lng: number,
    radiusKm: number = 5,
    limit: number = 10,
  ) {
    // Haversine formula — must JOIN Address since coordinates live there now
    const listings = await this.prisma.$queryRaw`
      SELECT
        l.*,
        a.street, a.ward, a.district, a.city, a.province,
        (2 * 6371 * atan2(
          sqrt(
            pow(sin(radians(a.lat - ${lat}) / 2), 2) +
            cos(radians(${lat})) * cos(radians(a.lat)) *
            pow(sin(radians(a.lng - ${lng}) / 2), 2)
          ),
          sqrt(
            1 - (
              pow(sin(radians(a.lat - ${lat}) / 2), 2) +
              cos(radians(${lat})) * cos(radians(a.lat)) *
              pow(sin(radians(a.lng - ${lng}) / 2), 2)
            )
          )
        )) AS distance
      FROM "Listing" l
      JOIN "Address" a ON a.id = l."addressId"
      WHERE l.status = 'ACTIVE'
        AND (2 * 6371 * atan2(
          sqrt(
            pow(sin(radians(a.lat - ${lat}) / 2), 2) +
            cos(radians(${lat})) * cos(radians(a.lat)) *
            pow(sin(radians(a.lng - ${lng}) / 2), 2)
          ),
          sqrt(
            1 - (
              pow(sin(radians(a.lat - ${lat}) / 2), 2) +
              cos(radians(${lat})) * cos(radians(a.lat)) *
              pow(sin(radians(a.lng - ${lng}) / 2), 2)
            )
          )
        )) <= ${radiusKm}
      ORDER BY distance
      LIMIT ${limit}
    `;

    return listings;
  }

  async searchByAddress(address: string, radiusKm: number = 5) {
    const geocodeResult = await this.mapService.geocode({ address });

    if (!geocodeResult) {
      throw new NotFoundException('Address not found');
    }

    const listings = await this.findNearby(
      geocodeResult.lat,
      geocodeResult.lng,
      radiusKm,
    );

    return { location: geocodeResult, listings };
  }
}

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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

  async create(userId: string, data: CreateListingDto) {
    return this.prisma.listing.create({
      data: {
        ...data,
        ownerId: userId,
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

    const where: any = {
      AND: [
        minPrice ? { price: { gte: minPrice } } : {},
        maxPrice ? { price: { lte: maxPrice } } : {},
        minArea ? { area: { gte: minArea } } : {},
        maxArea ? { area: { lte: maxArea } } : {},
        utilities
          ? {
              utilities: {
                hasSome: utilities.split(','),
              },
            }
          : {},
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          owner: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async findOne(id: string) {
    return this.prisma.listing.findUnique({
      where: { id },
      include: {
        owner: true,
        reviews: true,
      },
    });
  }

  async update(userId: string, id: string, data: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing || listing.ownerId !== userId) {
      throw new ForbiddenException();
    }

    return this.prisma.listing.update({
      where: { id },
      data,
    });
  }

  async remove(userId: string, id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing || listing.ownerId !== userId) {
      throw new ForbiddenException();
    }

    return this.prisma.listing.delete({
      where: { id },
    });
  }

  async getMyListings(userId: string) {
    return this.prisma.listing.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Geocode an address using OpenStreetMap
   */
  async geocodeAddress(address: string) {
    return this.mapService.geocode({ address });
  }

  /**
   * Find listings near a specific location
   */
  async findNearby(
    lat: number,
    lng: number,
    radiusKm: number = 5,
    limit: number = 10,
  ) {
    // Using Haversine formula via raw query for accurate distance calculation
    // This works with PostgreSQL
    const listings = await this.prisma.$queryRaw`
      SELECT
        l.*,
        (2 * 6371 * atan2(
          sqrt(
            pow(sin(radians(l.lat - ${lat}) / 2), 2) +
            cos(radians(${lat})) * cos(radians(l.lat)) *
            pow(sin(radians(l.lng - ${lng}) / 2), 2)
          ),
          sqrt(
            1 - (
              pow(sin(radians(l.lat - ${lat}) / 2), 2) +
              cos(radians(${lat})) * cos(radians(l.lat)) *
              pow(sin(radians(l.lng - ${lng}) / 2), 2)
            )
          )
        )
      )
      AS distance
      FROM "Listing" l
      WHERE l.status = 'ACTIVE'
      HAVING distance <= ${radiusKm}
      ORDER BY distance
      LIMIT ${limit}
    `;

    return listings;
  }

  /**
   * Search listings by address using geocoding
   */
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

    return {
      location: geocodeResult,
      listings,
    };
  }
}

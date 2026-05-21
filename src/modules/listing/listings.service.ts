import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma, ListingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MapService } from '../../integrations/map/map.service';
import { OpensearchService } from '../../integrations/opensearch/opensearch.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingDto } from './dto/query-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import {
  averageRating,
  mapListingWithRating,
  mapToListingSearchDoc,
} from './listing.mapper';
import { listingOwnerInclude, listingSummaryInclude } from './listing.queries';

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private prisma: PrismaService,
    private mapService: MapService,
    private opensearchService: OpensearchService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(
    userId: string,
    dto: CreateListingDto,
    files?: Express.Multer.File[],
  ) {
    const {
      street,
      ward,
      district,
      city,
      province,
      lat,
      lng,
      images: existingImages = [],
      ...listingFields
    } = dto;

    let uploadedImages: string[] = [];
    if (files && files.length > 0) {
      const uploadResults = await this.cloudinaryService.uploadFiles(files);
      uploadedImages = uploadResults.map((result) => result.secure_url);
    }

    const allImages = [...existingImages, ...uploadedImages];

    const listing = await this.prisma.listing.create({
      data: {
        ...listingFields,
        status: ListingStatus.ACTIVE,
        images: allImages,
        owner: { connect: { id: userId } },
        address: {
          create: { street, ward, district, city, province, lat, lng },
        },
      } satisfies Prisma.ListingCreateInput,
      include: listingOwnerInclude,
    });

    if (listing.status === ListingStatus.ACTIVE) {
      await this.opensearchService.indexListing(mapToListingSearchDoc(listing));
    }

    return listing;
  }

  async findAll(query: QueryListingDto) {
    const {
      search,
      district,
      ward,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      utilities,
      page = 1,
      limit = 10,
    } = query;

    // Try OpenSearch first if there's a search term
    if (search) {
      try {
        const { listings: searchResults, total } = await this.opensearchService.searchListings(
          search,
          {
            district,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            minArea: minArea ? Number(minArea) : undefined,
            maxArea: maxArea ? Number(maxArea) : undefined,
            utilities: typeof utilities === 'string' ? utilities.split(',') : utilities,
            status: 'ACTIVE',
          },
          Number(page),
          Number(limit),
        );

        if (total > 0) {
          // Map OpenSearch results back to our format
          // Note: OpenSearch might not have all relations, so we might need to fetch them from DB
          // or just return what's in OpenSearch if it's enough.
          // For now, let's fetch IDs from DB to ensure we have all counts/relations correctly.
          const ids = searchResults.map(r => r.id);
          const data = await this.prisma.listing.findMany({
            where: { id: { in: ids } },
            include: listingSummaryInclude,
          });

          // Sort back to match OpenSearch order
          const sortedData = ids.map(id => {
            const l = data.find(item => item.id === id);
            if (!l) return null;
            return mapListingWithRating(l);
          }).filter(Boolean);

          return {
            data: sortedData,
            meta: { page: Number(page), limit: Number(limit), total },
          };
        }
      } catch (error) {
        // Fallback to DB if OpenSearch fails
        this.logger.warn(
          `OpenSearch search failed, falling back to DB: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const where: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
    };

    const andConditions: Prisma.ListingWhereInput[] = [];

    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          {
            address: {
              OR: [
                { street: { contains: search, mode: 'insensitive' } },
                { ward: { contains: search, mode: 'insensitive' } },
                { district: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
                { province: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      });
    }

    if (district || ward) {
      where.address = {
        ...(district && { district }),
        ...(ward && { ward }),
      };
    }

    if (minPrice !== undefined) {
      andConditions.push({ price: { gte: Number(minPrice) } });
    }
    if (maxPrice !== undefined) {
      andConditions.push({ price: { lte: Number(maxPrice) } });
    }
    if (minArea !== undefined) {
      andConditions.push({ area: { gte: Number(minArea) } });
    }
    if (maxArea !== undefined) {
      andConditions.push({ area: { lte: Number(maxArea) } });
    }

    if (utilities) {
      const utilityList =
        typeof utilities === 'string' ? utilities.split(',') : utilities;
      andConditions.push({ utilities: { hasSome: utilityList } });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: listingSummaryInclude,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.listing.count({ where }),
    ]);

    const mappedData = data.map(mapListingWithRating);

    return {
      data: mappedData,
      meta: { page: Number(page), limit: Number(limit), total },
    };
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        address: true,
        owner: { select: { id: true, name: true, avatarUrl: true, phone: true } },
        _count: { select: { reviews: true } },
        reviews: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const avgRating = averageRating(listing.reviews);

    const { _count, ...rest } = listing;

    return {
      ...rest,
      reviewCount: _count?.reviews ?? 0,
      avgRating: Number(avgRating.toFixed(1)),
    };
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

    const updatedListing = await this.prisma.listing.update({
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

    if (updatedListing.status === ListingStatus.ACTIVE) {
      await this.opensearchService.indexListing(mapToListingSearchDoc(updatedListing));
    } else {
      await this.opensearchService.deleteListing(updatedListing.id);
    }

    return updatedListing;
  }

  async remove(userId: string, id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });

    if (!listing || listing.ownerId !== userId) {
      throw new ForbiddenException();
    }

    const deleted = await this.prisma.listing.delete({ where: { id } });
    await this.opensearchService.deleteListing(id);
    return deleted;
  }

  async getMyListings(userId: string) {
    return this.prisma.listing.findMany({
      where: { ownerId: userId },
      include: { address: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLocations() {
    const addresses = await this.prisma.address.findMany({
      select: { city: true, district: true, ward: true },
      distinct: ['city', 'district', 'ward'],
    });

    const locations: Record<string, Record<string, string[]>> = {};

    addresses.forEach((addr) => {
      if (!locations[addr.city]) {
        locations[addr.city] = {};
      }
      if (!locations[addr.city][addr.district]) {
        locations[addr.city][addr.district] = [];
      }
      if (addr.ward && !locations[addr.city][addr.district].includes(addr.ward)) {
        locations[addr.city][addr.district].push(addr.ward);
      }
    });

    return locations;
  }

  async geocodeAddress(address: string) {
    return this.mapService.geocode({ address });
  }

  async uploadImages(files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      return [];
    }
    const uploadResults = await this.cloudinaryService.uploadFiles(files);
    return uploadResults.map((result) => result.secure_url);
  }

  async findNearby(
    lat: number,
    lng: number,
    radiusKm: number = 5,
    limit: number = 10,
  ) {
    // Haversine formula — must JOIN Address since coordinates live there now
    // We also join Review to get real counts and ratings
    const listings = await this.prisma.$queryRaw<any[]>`
      SELECT
        l.*,
        a.street, a.ward, a.district, a.city, a.province, a.lat, a.lng,
        u.name as "ownerName", u."avatarUrl" as "ownerAvatar",
        COALESCE(r.count, 0) as "reviewCount",
        COALESCE(r.avg, 0) as "avgRating",
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
      JOIN "User" u ON u.id = l."ownerId"
      LEFT JOIN (
        SELECT "listingId", COUNT(*)::int as count, AVG(rating)::float as avg
        FROM "Review"
        GROUP BY "listingId"
      ) r ON r."listingId" = l.id
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

    return listings.map((l) => ({
      ...l,
      address: {
        street: l.street,
        ward: l.ward,
        district: l.district,
        city: l.city,
        province: l.province,
        lat: l.lat,
        lng: l.lng,
      },
      owner: {
        id: l.ownerId,
        name: l.ownerName,
        avatarUrl: l.ownerAvatar,
      },
      reviewCount: l.reviewCount ?? 0,
      avgRating: l.avgRating ?? 0,
    }));
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

  async saveListing(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    try {
      await this.prisma.savedListing.create({
        data: { userId, listingId },
      });
      return { success: true, message: 'Listing saved' };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Listing already saved');
      }
      throw error;
    }
  }

  async unsaveListing(userId: string, listingId: string) {
    await this.prisma.savedListing
      .delete({
        where: { userId_listingId: { userId, listingId } },
      })
      .catch(() => {
        throw new NotFoundException('Saved listing not found');
      });
    return { success: true, message: 'Listing unsaved' };
  }

  async getSavedListings(userId: string, page: number = 1, limit: number = 20) {
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const [data, total] = await Promise.all([
      this.prisma.savedListing.findMany({
        where: { userId },
        include: {
          listing: {
            include: {
              address: true,
              ...listingSummaryInclude,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.savedListing.count({ where: { userId } }),
    ]);

    return {
      data: data.map((item) => {
        return {
          ...mapListingWithRating(item.listing),
          savedAt: item.createdAt.toISOString(),
        };
      }),
      meta: { page: pageNum, limit: limitNum, total },
    };
  }

  async isListingSaved(userId: string, listingId: string) {
    const saved = await this.prisma.savedListing.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });
    return { saved: !!saved };
  }
}

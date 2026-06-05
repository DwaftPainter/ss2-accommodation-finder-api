import {
  Injectable,
  BadRequestException,
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
import { SearchListingDto } from './dto/search-listing.dto';
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
      Promise.resolve(
        this.opensearchService.indexListing(mapToListingSearchDoc(listing)),
      ).catch((error: Error) => {
        this.logger.warn(`OpenSearch indexing failed: ${error.message}`);
      });
    }

    return listing;
  }

  async findAll(query: QueryListingDto | SearchListingDto) {
    const {
      search,
      province,
      city,
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
    const provinceTerms = this.locationTerms(province);
    const wardTerms = this.locationTerms(ward);
    const utilityTermGroups = this.utilityTermGroups(utilities);

    // Try OpenSearch first if there's a search term
    if (search) {
      try {
        const { listings: searchResults, total } =
          await this.opensearchService.searchListings(
            search,
            {
              province: provinceTerms.length > 0 ? provinceTerms : undefined,
              city,
              district,
              ward: wardTerms.length > 0 ? wardTerms : undefined,
              minPrice: minPrice ? Number(minPrice) : undefined,
              maxPrice: maxPrice ? Number(maxPrice) : undefined,
              minArea: minArea ? Number(minArea) : undefined,
              maxArea: maxArea ? Number(maxArea) : undefined,
              utilities: utilityTermGroups.length > 0 ? utilityTermGroups : undefined,
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
          const ids = searchResults.map((r) => r.id);
          const data = await this.prisma.listing.findMany({
            where: { id: { in: ids } },
            include: listingSummaryInclude,
          });

          // Sort back to match OpenSearch order
          const sortedData = ids
            .map((id) => {
              const l = data.find((item) => item.id === id);
              return l ?? null;
            })
            .filter((listing): listing is (typeof data)[number] =>
              Boolean(listing),
            );

          return {
            data: await this.mapListingsWithRatings(sortedData),
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

    if (province || city || district || ward) {
      where.address = {
        ...(provinceTerms.length > 0 && { province: { in: provinceTerms } }),
        ...(city && { city }),
        ...(district && { district }),
        ...(wardTerms.length > 0 && { ward: { in: wardTerms } }),
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

    utilityTermGroups.forEach((utilityTerms) => {
      andConditions.push({ utilities: { hasSome: utilityTerms } });
    });

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

    const mappedData = await this.mapListingsWithRatings(data);

    return {
      data: mappedData,
      meta: { page: Number(page), limit: Number(limit), total },
    };
  }

  private utilityTermGroups(utilities?: string | string[]) {
    const values = Array.isArray(utilities)
      ? utilities
      : (utilities ?? '').split(',');

    return values
      .map((utility) => utility.trim())
      .filter(Boolean)
      .map((utility) => this.utilityTerms(utility));
  }

  private utilityTerms(value: string) {
    const aliases: Record<string, string[]> = {
      wifi: ['wifi', 'WiFi'],
      air_conditioning: ['air_conditioning', 'Air Conditioning'],
      balcony: ['balcony', 'Balcony'],
      washing_machine: ['washing_machine', 'Washing Machine'],
      parking: ['parking', 'Parking'],
      elevator: ['elevator', 'Elevator'],
      security: ['security', 'Security'],
      flexible_hours: ['flexible_hours', 'Flexible Hours'],
    };

    return aliases[value] ?? [value];
  }

  private locationTerms(value?: string) {
    const trimmed = value?.trim();
    if (!trimmed) return [];

    const terms = new Set<string>([trimmed]);
    const withoutPrefix = trimmed.replace(
      /^(Thành phố|Tỉnh|TP\.|Phường|Xã|Thị trấn)\s+/i,
      '',
    );
    if (withoutPrefix && withoutPrefix !== trimmed) {
      terms.add(withoutPrefix);
    }
    if (withoutPrefix === 'Hồ Chí Minh') {
      terms.add('TP. Hồ Chí Minh');
      terms.add('Thành phố Hồ Chí Minh');
    }
    if (withoutPrefix === 'Hà Nội') {
      terms.add('Thành phố Hà Nội');
    }

    return [...terms];
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
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
      await this.opensearchService.indexListing(
        mapToListingSearchDoc(updatedListing),
      );
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
      if (
        addr.ward &&
        !locations[addr.city][addr.district].includes(addr.ward)
      ) {
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
      throw new BadRequestException('At least one image file is required');
    }
    const uploadResults = await this.cloudinaryService.uploadFiles(files);
    return uploadResults.map((result) => result.secure_url);
  }

  async findNearby(
    lat: number,
    lng: number,
    radiusKm: number = 5,
    limit: number = 30,
    filters: Pick<
      QueryListingDto,
      'province' | 'city' | 'district' | 'ward' | 'utilities'
    > = {},
  ) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Invalid coordinates');
    }
    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      throw new BadRequestException('Radius must be greater than 0');
    }

    const provinceTerms = this.locationTerms(filters.province);
    const wardTerms = this.locationTerms(filters.ward);
    const utilityTermGroups = this.utilityTermGroups(filters.utilities);
    const where: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
      address: {
        ...(provinceTerms.length > 0 && { province: { in: provinceTerms } }),
        ...(filters.city && { city: filters.city }),
        ...(filters.district && { district: filters.district }),
        ...(wardTerms.length > 0 && { ward: { in: wardTerms } }),
      },
      ...(utilityTermGroups.length > 0 && {
        AND: utilityTermGroups.map((utilityTerms) => ({
          utilities: { hasSome: utilityTerms },
        })),
      }),
    };

    const candidates = await this.prisma.listing.findMany({
      where,
      include: listingSummaryInclude,
    });

    const nearby = candidates
      .map((listing) => ({
        listing,
        distance: this.distanceKm(
          lat,
          lng,
          listing.address.lat,
          listing.address.lng,
        ),
      }))
      .filter(({ distance }) => distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    const mappedListings = await this.mapListingsWithRatings(
      nearby.map(({ listing }) => listing),
    );
    const distanceByListingId = new Map(
      nearby.map(({ listing, distance }) => [listing.id, distance]),
    );

    return mappedListings.map((listing) => ({
      ...listing,
      distance: distanceByListingId.get(listing.id) ?? 0,
    }));
  }

  private distanceKm(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ) {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRadians(toLat - fromLat);
    const dLng = toRadians(toLng - fromLng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(fromLat)) *
        Math.cos(toRadians(toLat)) *
        Math.sin(dLng / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
            include: listingSummaryInclude,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.savedListing.count({ where: { userId } }),
    ]);

    const mappedListings = await this.mapListingsWithRatings(
      data.map((item) => item.listing),
    );
    const mappedById = new Map(
      mappedListings.map((listing) => [listing.id, listing]),
    );

    return {
      data: data.map((item) => ({
        ...mappedById.get(item.listing.id)!,
        savedAt: item.createdAt.toISOString(),
      })),
      meta: { page: pageNum, limit: limitNum, total },
    };
  }

  async isListingSaved(userId: string, listingId: string) {
    const saved = await this.prisma.savedListing.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });
    return { saved: !!saved };
  }

  private async mapListingsWithRatings<
    T extends Parameters<typeof mapListingWithRating>[0],
  >(listings: T[]) {
    if (listings.length === 0) {
      return [];
    }

    const ratingRows = await this.prisma.review.groupBy({
      by: ['listingId'],
      where: { listingId: { in: listings.map((listing) => listing.id) } },
      _avg: { rating: true },
      _count: { _all: true },
    });

    const ratingsByListing = new Map(
      ratingRows.map((row) => [
        row.listingId,
        {
          avgRating: row._avg.rating ?? 0,
          reviewCount: row._count._all,
        },
      ]),
    );

    return listings.map((listing) =>
      mapListingWithRating(listing, ratingsByListing.get(listing.id)),
    );
  }
}

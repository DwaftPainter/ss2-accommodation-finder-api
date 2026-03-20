import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ListingsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: any) {
    return this.prisma.listing.create({
      data: {
        ...data,
        ownerId: userId,
      },
    });
  }

  async findAll(query: any) {
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

  async update(userId: string, id: string, data: any) {
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
}

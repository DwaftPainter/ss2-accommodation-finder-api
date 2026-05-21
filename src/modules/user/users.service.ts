import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpensearchService, UserSearchDoc } from '../../integrations/opensearch/opensearch.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private opensearch: OpensearchService,
  ) {}

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
  }

  async updateMe(userId: string, data: any) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
      },
    });

    // Update OpenSearch index (fire and forget)
    this.opensearch
      .updateUser(userId, { name: updated.name, phone: updated.phone })
      .catch((err) =>
        this.logger.warn(`OpenSearch update failed: ${err.message}`),
      );

    return updated;
  }

  async searchUsers(
    query: string,
    filters?: { role?: string; status?: string; emailVerified?: boolean },
    page: number = 1,
    limit: number = 20,
  ) {
    // Try OpenSearch first with fallback to PostgreSQL
    try {
      const osFilters: any = {};
      if (filters?.role) osFilters.role = filters.role;
      if (filters?.status) osFilters.status = filters.status;
      if (filters?.emailVerified !== undefined)
        osFilters.emailVerified = filters.emailVerified;

      const result = await this.opensearch.searchUsers(
        query,
        osFilters,
        page,
        limit,
      );

      this.logger.log(
        `OpenSearch returned ${result.total} users for query "${query}"`,
      );
      return result;
    } catch (error) {
      this.logger.warn(
        `OpenSearch search failed, falling back to PostgreSQL: ${error.message}`,
      );

      // Fallback to PostgreSQL
      const where: any = {};

      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
        ];
      }

      if (filters?.role) where.role = filters.role;
      if (filters?.status) where.status = filters.status;
      if (filters?.emailVerified !== undefined)
        where.emailVerified = filters.emailVerified;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            emailVerified: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.user.count({ where }),
      ]);

      return { users, total };
    }
  }

  async indexUser(user: any) {
    const doc: UserSearchDoc = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    };

    try {
      await this.opensearch.indexUser(doc);
      this.logger.log(`Indexed user ${user.id} in OpenSearch`);
    } catch (error) {
      this.logger.warn(`Failed to index user ${user.id}: ${error.message}`);
    }
  }
}

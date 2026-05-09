import {
  Injectable,
  OnModuleInit,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';

export interface UserSearchDoc {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface ChatMessageDoc {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: string;
  createdAt: string;
  listingId?: string;
}

export interface UserSearchFilters {
  role?: string;
  status?: string;
  emailVerified?: boolean;
  createdAfter?: string;
  createdBefore?: string;
}

export interface ChatSearchFilters {
  chatId?: string;
  senderId?: string;
  listingId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ListingSearchDoc {
  id: string;
  ownerId: string;
  title: string;
  type: string;
  price: number;
  area: number;
  description?: string;
  utilities: string[];
  images: string[];
  status: string;
  createdAt: string;
  address: {
    street: string;
    ward?: string;
    district: string;
    city: string;
    province: string;
    location: {
      lat: number;
      lon: number;
    };
  };
}

export interface ListingSearchFilters {
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  utilities?: string[];
  district?: string;
  city?: string;
  status?: string;
  lat?: number;
  lon?: number;
  radius?: string; // e.g. "5km"
}

@Injectable()
export class OpensearchService implements OnModuleInit {
  private client: Client;
  private readonly logger = new Logger(OpensearchService.name);

  readonly USER_INDEX = 'users';
  readonly CHAT_INDEX = 'chat_messages';
  readonly LISTING_INDEX = 'listings';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const node = this.configService.get<string>('opensearch.node');

    this.client = new Client({
      node: node,
    });

    this.logger.log('OpenSearch client initialized');

    // Create indices on startup (ignore errors if OpenSearch unavailable)
    try {
      await this.createIndices();
      this.logger.log('OpenSearch indices ready');
    } catch (error: any) {
      this.logger.warn(
        `Failed to create OpenSearch indices: ${error.message}. Fallback to database will be used.`,
      );
    }
  }

  async createIndices(): Promise<void> {
    try {
      await this.createUserIndex();
      await this.createChatIndex();
      await this.createListingIndex();
    } catch (error) {
      this.logger.error('Failed to create indices', error);
      throw new InternalServerErrorException(
        'Failed to create OpenSearch indices',
      );
    }
  }

  private async createUserIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.USER_INDEX });

    if (!exists.body) {
      await this.client.indices.create({
        index: this.USER_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              name: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              email: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              phone: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              role: { type: 'keyword' },
              status: { type: 'keyword' },
              emailVerified: { type: 'boolean' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      this.logger.log(`Created index: ${this.USER_INDEX}`);
    }
  }

  private async createChatIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.CHAT_INDEX });

    if (!exists.body) {
      await this.client.indices.create({
        index: this.CHAT_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              chatId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              senderName: { type: 'text' },
              content: { type: 'text' },
              type: { type: 'keyword' },
              createdAt: { type: 'date' },
              listingId: { type: 'keyword' },
            },
          },
        },
      });
      this.logger.log(`Created index: ${this.CHAT_INDEX}`);
    }
  }

  private async createListingIndex(): Promise<void> {
    const exists = await this.client.indices.exists({
      index: this.LISTING_INDEX,
    });

    if (!exists.body) {
      await this.client.indices.create({
        index: this.LISTING_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              ownerId: { type: 'keyword' },
              title: {
                type: 'text',
                analyzer: 'standard',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              type: { type: 'keyword' },
              price: { type: 'integer' },
              area: { type: 'float' },
              description: { type: 'text', analyzer: 'standard' },
              utilities: { type: 'keyword' },
              images: { type: 'keyword', index: false },
              status: { type: 'keyword' },
              createdAt: { type: 'date' },
              address: {
                properties: {
                  street: { type: 'text' },
                  ward: { type: 'keyword' },
                  district: { type: 'keyword' },
                  city: { type: 'keyword' },
                  province: { type: 'keyword' },
                  location: { type: 'geo_point' },
                },
              },
            },
          },
        },
      });
      this.logger.log(`Created index: ${this.LISTING_INDEX}`);
    }
  }

  async indexListing(listing: ListingSearchDoc): Promise<void> {
    try {
      await this.client.index({
        index: this.LISTING_INDEX,
        id: listing.id,
        body: listing,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to index listing ${listing.id}`, error);
      throw new InternalServerErrorException('Failed to index listing');
    }
  }

  async indexListings(listings: ListingSearchDoc[]): Promise<void> {
    if (listings.length === 0) return;

    const body = listings.flatMap((listing) => [
      { index: { _index: this.LISTING_INDEX, _id: listing.id } },
      listing,
    ]);

    try {
      await this.client.bulk({ body, refresh: true });
    } catch (error) {
      this.logger.error('Failed to bulk index listings', error);
      throw new InternalServerErrorException('Failed to bulk index listings');
    }
  }

  async updateListing(
    listingId: string,
    partial: Partial<ListingSearchDoc>,
  ): Promise<void> {
    try {
      await this.client.update({
        index: this.LISTING_INDEX,
        id: listingId,
        body: { doc: partial },
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to update listing ${listingId}`, error);
      throw new InternalServerErrorException('Failed to update listing index');
    }
  }

  async deleteListing(listingId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.LISTING_INDEX,
        id: listingId,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(
        `Failed to delete listing ${listingId} from index`,
        error,
      );
    }
  }

  async searchListings(
    query: string,
    filters: ListingSearchFilters = {},
    page = 1,
    limit = 20,
  ): Promise<{ listings: ListingSearchDoc[]; total: number }> {
    const must: any[] = [];
    const filter: any[] = [];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['title^3', 'description', 'address.street', 'address.district'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (filters.type) {
      filter.push({ term: { type: filters.type } });
    }
    if (filters.status) {
      filter.push({ term: { status: filters.status } });
    }
    if (filters.city) {
      filter.push({ term: { 'address.city': filters.city } });
    }
    if (filters.district) {
      filter.push({ term: { 'address.district': filters.district } });
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const range: any = {};
      if (filters.minPrice !== undefined) range.gte = filters.minPrice;
      if (filters.maxPrice !== undefined) range.lte = filters.maxPrice;
      filter.push({ range: { price: range } });
    }
    if (filters.minArea !== undefined || filters.maxArea !== undefined) {
      const range: any = {};
      if (filters.minArea !== undefined) range.gte = filters.minArea;
      if (filters.maxArea !== undefined) range.lte = filters.maxArea;
      filter.push({ range: { area: range } });
    }
    if (filters.utilities && filters.utilities.length > 0) {
      filters.utilities.forEach((utility) => {
        filter.push({ term: { utilities: utility } });
      });
    }
    if (
      filters.lat !== undefined &&
      filters.lon !== undefined &&
      filters.radius
    ) {
      filter.push({
        geo_distance: {
          distance: filters.radius,
          'address.location': {
            lat: filters.lat,
            lon: filters.lon,
          },
        },
      });
    }

    const searchBody: any = {
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
        },
      },
      sort: [{ createdAt: { order: 'desc' } }],
      from: (page - 1) * limit,
      size: limit,
    };

    try {
      const response = await this.client.search({
        index: this.LISTING_INDEX,
        body: searchBody,
      });

      const hits = response.body.hits.hits;
      const totalHits = response.body.hits.total;
      const total =
        typeof totalHits === 'number'
          ? totalHits
          : totalHits?.value ?? 0;

      const listings = hits.map((hit: any) => hit._source as ListingSearchDoc);

      return { listings, total };
    } catch (error) {
      this.logger.error('Failed to search listings', error);
      throw new InternalServerErrorException('Failed to search listings');
    }
  }

  async indexUser(user: UserSearchDoc): Promise<void> {
    try {
      await this.client.index({
        index: this.USER_INDEX,
        id: user.id,
        body: user,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to index user ${user.id}`, error);
      throw new InternalServerErrorException('Failed to index user');
    }
  }

  async indexUsers(users: UserSearchDoc[]): Promise<void> {
    if (users.length === 0) return;

    const body = users.flatMap((user) => [
      { index: { _index: this.USER_INDEX, _id: user.id } },
      user,
    ]);

    try {
      await this.client.bulk({ body, refresh: true });
    } catch (error) {
      this.logger.error('Failed to bulk index users', error);
      throw new InternalServerErrorException('Failed to bulk index users');
    }
  }

  async updateUser(
    userId: string,
    partial: Partial<UserSearchDoc>,
  ): Promise<void> {
    try {
      await this.client.update({
        index: this.USER_INDEX,
        id: userId,
        body: { doc: partial },
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to update user ${userId}`, error);
      throw new InternalServerErrorException('Failed to update user index');
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.USER_INDEX,
        id: userId,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to delete user ${userId} from index`, error);
    }
  }

  async searchUsers(
    query: string,
    filters: UserSearchFilters = {},
    page = 1,
    limit = 20,
  ): Promise<{ users: UserSearchDoc[]; total: number }> {
    const must: any[] = [];
    const filter: any[] = [];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['name^2', 'email', 'phone'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (filters.role) {
      filter.push({ term: { role: filters.role } });
    }
    if (filters.status) {
      filter.push({ term: { status: filters.status } });
    }
    if (filters.emailVerified !== undefined) {
      filter.push({ term: { emailVerified: filters.emailVerified } });
    }
    if (filters.createdAfter) {
      filter.push({
        range: {
          createdAt: { gte: filters.createdAfter },
        },
      });
    }
    if (filters.createdBefore) {
      filter.push({
        range: {
          createdAt: { lte: filters.createdBefore },
        },
      });
    }

    const searchBody: any = {
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
        },
      },
      sort: [{ createdAt: { order: 'desc' } }],
      from: (page - 1) * limit,
      size: limit,
    };

    try {
      const response = await this.client.search({
        index: this.USER_INDEX,
        body: searchBody,
      });

      const hits = response.body.hits.hits;
      const totalHits = response.body.hits.total;
      const total =
        typeof totalHits === 'number'
          ? totalHits
          : totalHits?.value ?? 0;

      const users = hits.map((hit: any) => hit._source as UserSearchDoc);

      return { users, total };
    } catch (error) {
      this.logger.error('Failed to search users', error);
      throw new InternalServerErrorException('Failed to search users');
    }
  }

  async indexMessage(message: ChatMessageDoc): Promise<void> {
    try {
      await this.client.index({
        index: this.CHAT_INDEX,
        id: message.id,
        body: message,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to index message ${message.id}`, error);
      throw new InternalServerErrorException('Failed to index message');
    }
  }

  async indexMessages(messages: ChatMessageDoc[]): Promise<void> {
    if (messages.length === 0) return;

    const body = messages.flatMap((message) => [
      { index: { _index: this.CHAT_INDEX, _id: message.id } },
      message,
    ]);

    try {
      await this.client.bulk({ body, refresh: true });
    } catch (error) {
      this.logger.error('Failed to bulk index messages', error);
      throw new InternalServerErrorException('Failed to bulk index messages');
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.CHAT_INDEX,
        id: messageId,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(
        `Failed to delete message ${messageId} from index`,
        error,
      );
    }
  }

  async deleteChatMessages(chatId: string): Promise<void> {
    try {
      await this.client.deleteByQuery({
        index: this.CHAT_INDEX,
        body: {
          query: {
            term: { chatId },
          },
        },
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to delete messages for chat ${chatId}`, error);
    }
  }

  async searchChatMessages(
    query: string,
    filters: ChatSearchFilters = {},
    page = 1,
    limit = 20,
  ): Promise<{ messages: ChatMessageDoc[]; total: number }> {
    const must: any[] = [];
    const filter: any[] = [];

    if (query) {
      must.push({
        match: {
          content: {
            query,
            fuzziness: 'AUTO',
          },
        },
      });
    }

    if (filters.chatId) {
      filter.push({ term: { chatId: filters.chatId } });
    }
    if (filters.senderId) {
      filter.push({ term: { senderId: filters.senderId } });
    }
    if (filters.listingId) {
      filter.push({ term: { listingId: filters.listingId } });
    }
    if (filters.dateFrom || filters.dateTo) {
      const range: any = {};
      if (filters.dateFrom) range.gte = filters.dateFrom;
      if (filters.dateTo) range.lte = filters.dateTo;
      filter.push({ range: { createdAt: range } });
    }

    const searchBody: any = {
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
        },
      },
      sort: [{ createdAt: { order: 'desc' } }],
      from: (page - 1) * limit,
      size: limit,
    };

    try {
      const response = await this.client.search({
        index: this.CHAT_INDEX,
        body: searchBody,
      });

      const hits = response.body.hits.hits;
      const totalHits = response.body.hits.total;
      const total =
        typeof totalHits === 'number'
          ? totalHits
          : totalHits?.value ?? 0;

      const messages = hits.map((hit: any) => hit._source as ChatMessageDoc);

      return { messages, total };
    } catch (error) {
      this.logger.error('Failed to search chat messages', error);
      throw new InternalServerErrorException('Failed to search chat messages');
    }
  }

  async searchUserChats(
    userId: string,
    query: string,
    page = 1,
    limit = 20,
  ): Promise<{ messages: ChatMessageDoc[]; total: number }> {
    const must: any[] = [{ term: { senderId: userId } }];

    if (query) {
      must.push({
        match: {
          content: {
            query,
            fuzziness: 'AUTO',
          },
        },
      });
    }

    const searchBody: any = {
      query: {
        bool: {
          must,
        },
      },
      sort: [{ createdAt: { order: 'desc' } }],
      from: (page - 1) * limit,
      size: limit,
    };

    try {
      const response = await this.client.search({
        index: this.CHAT_INDEX,
        body: searchBody,
      });

      const hits = response.body.hits.hits;
      const totalHits = response.body.hits.total;
      const total =
        typeof totalHits === 'number'
          ? totalHits
          : totalHits?.value ?? 0;

      const messages = hits.map((hit: any) => hit._source as ChatMessageDoc);

      return { messages, total };
    } catch (error) {
      this.logger.error('Failed to search user chats', error);
      throw new InternalServerErrorException('Failed to search user chats');
    }
  }

  async getChatHistory(
    chatId: string,
    page = 1,
    limit = 50,
  ): Promise<{ messages: ChatMessageDoc[]; total: number }> {
    try {
      const response = await this.client.search({
        index: this.CHAT_INDEX,
        body: {
          query: {
            term: { chatId },
          },
          sort: [{ createdAt: { order: 'asc' } }],
          from: (page - 1) * limit,
          size: limit,
        },
      });

      const hits = response.body.hits.hits;
      const totalHits = response.body.hits.total;
      const total =
        typeof totalHits === 'number'
          ? totalHits
          : totalHits?.value ?? 0;

      const messages = hits.map((hit: any) => hit._source as ChatMessageDoc);

      return { messages, total };
    } catch (error) {
      this.logger.error(`Failed to get chat history for ${chatId}`, error);
      throw new InternalServerErrorException('Failed to get chat history');
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.cluster.health();
      return response.body.status !== 'red';
    } catch (error) {
      this.logger.error('OpenSearch health check failed', error);
      return false;
    }
  }
}

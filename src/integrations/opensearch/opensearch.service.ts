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

@Injectable()
export class OpensearchService implements OnModuleInit {
  private client: Client;
  private readonly logger = new Logger(OpensearchService.name);

  readonly USER_INDEX = 'users';
  readonly CHAT_INDEX = 'chat_messages';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const node = this.configService.get<string>('opensearch.node');
    const username = this.configService.get<string>('opensearch.username');
    const password = this.configService.get<string>('opensearch.password');
    const ssl = this.configService.get<boolean>('opensearch.ssl');

    this.client = new Client({
      node,
      auth: {
        username,
        password,
      },
      ssl: {
        rejectUnauthorized: ssl,
      },
    });

    this.logger.log('OpenSearch client initialized');
  }

  async createIndices(): Promise<void> {
    try {
      await this.createUserIndex();
      await this.createChatIndex();
    } catch (error) {
      this.logger.error('Failed to create indices', error);
      throw new InternalServerErrorException('Failed to create OpenSearch indices');
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

  async updateUser(userId: string, partial: Partial<UserSearchDoc>): Promise<void> {
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
      const total = typeof response.body.hits.total === 'number'
        ? response.body.hits.total
        : response.body.hits.total.value;

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
      this.logger.error(`Failed to delete message ${messageId} from index`, error);
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
      const total = typeof response.body.hits.total === 'number'
        ? response.body.hits.total
        : response.body.hits.total.value;

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
    const must: any[] = [
      { term: { senderId: userId } },
    ];

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
      const total = typeof response.body.hits.total === 'number'
        ? response.body.hits.total
        : response.body.hits.total.value;

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
      const total = typeof response.body.hits.total === 'number'
        ? response.body.hits.total
        : response.body.hits.total.value;

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

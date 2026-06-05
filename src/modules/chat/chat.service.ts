import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OpensearchService,
  ChatMessageDoc,
} from '../../integrations/opensearch/opensearch.service';
import { NotificationsService } from '../notification/notifications.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private opensearch: OpensearchService,
    private notifications: NotificationsService,
  ) {}

  async createChat(userId: string, otherUserId: string, listingId?: string) {
    // Ensure user1Id < user2Id for consistency
    const [user1Id, user2Id] =
      userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];

    // Check if chat already exists. Nullable compound unique fields cannot be
    // found reliably with a sentinel value, so use findFirst for both cases.
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        user1Id,
        user2Id,
        listingId: listingId ?? null,
      },
      include: {
        user1: { select: { id: true, name: true, avatarUrl: true } },
        user2: { select: { id: true, name: true, avatarUrl: true } },
        listing: { select: { id: true, title: true, images: true } },
      },
    });

    if (existingChat) {
      return existingChat;
    }

    return this.prisma.chat.create({
      data: {
        user1Id,
        user2Id,
        listingId: listingId ?? null,
      },
      include: {
        user1: { select: { id: true, name: true, avatarUrl: true } },
        user2: { select: { id: true, name: true, avatarUrl: true } },
        listing: listingId
          ? { select: { id: true, title: true, images: true } }
          : false,
      },
    });
  }

  async getUserChats(userId: string) {
    return this.prisma.chat.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: { select: { id: true, name: true, avatarUrl: true } },
        user2: { select: { id: true, name: true, avatarUrl: true } },
        listing: { select: { id: true, title: true, images: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
            isRead: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getChatMessages(
    userId: string,
    chatId: string,
    skip: number = 0,
    take: number = 20,
  ) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat || (chat.user1Id !== userId && chat.user2Id !== userId)) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.message.updateMany({
      where: {
        chatId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      this.prisma.message.count({ where: { chatId } }),
    ]);

    return {
      messages,
      meta: {
        total,
        skip,
        take,
        hasMore: skip + take < total,
      },
    };
  }

  async createMessage(chatId: string, senderId: string, content: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.user1Id !== senderId && chat.user2Id !== senderId) {
      throw new ForbiddenException('Access denied');
    }

    // Create message and update chat's updatedAt
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          chatId,
          senderId,
          content,
        },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      this.prisma.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      }),
    ]);

    // Index message in OpenSearch (fire and forget)
    this.indexMessageInBackground(message, chat);
    this.notifyRecipientInBackground(message, chat);

    return message;
  }

  private notifyRecipientInBackground(message: any, chat: any) {
    const recipientId =
      chat.user1Id === message.senderId ? chat.user2Id : chat.user1Id;

    this.notifications
      .createForUser({
        userId: recipientId,
        type: 'NEW_MESSAGE',
        title: `Tin nhắn mới từ ${message.sender.name}`,
        body: message.content,
        refId: chat.id,
      })
      .catch((error) =>
        this.logger.warn(
          `Failed to create message notification: ${error.message}`,
        ),
      );
  }

  private async indexMessageInBackground(message: any, chat: any) {
    const doc: ChatMessageDoc = {
      id: message.id,
      chatId: chat.id,
      senderId: message.senderId,
      senderName: message.sender.name,
      content: message.content,
      type: 'text',
      createdAt: message.createdAt.toISOString(),
      listingId: chat.listingId || undefined,
    };

    try {
      await this.opensearch.indexMessage(doc);
      this.logger.log(`Indexed message ${message.id} in OpenSearch`);
    } catch (error) {
      this.logger.warn(
        `Failed to index message ${message.id}: ${error.message}`,
      );
    }
  }

  async getUnreadCount(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      select: { id: true },
    });

    const chatIds = chats.map((c) => c.id);

    const count = await this.prisma.message.count({
      where: {
        chatId: { in: chatIds },
        senderId: { not: userId },
        isRead: false,
      },
    });

    return { count };
  }

  async searchMessages(
    userId: string,
    query: string,
    filters?: { chatId?: string },
    page: number = 1,
    limit: number = 20,
  ) {
    const chat = await this.prisma.chat.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      select: { id: true },
    });
    const chatIds = chat.map((c) => c.id);
    if (chatIds.length === 0) return { messages: [], total: 0 };

    // Try OpenSearch first with fallback to PostgreSQL
    try {
      const osFilters: any = { chatIds };
      if (filters?.chatId) osFilters.chatId = filters.chatId;

      const result = await this.opensearch.searchChatMessages(
        query,
        osFilters,
        page,
        limit,
      );

      this.logger.log(
        `OpenSearch returned ${result.total} messages for query "${query}"`,
      );
      return result;
    } catch (error) {
      this.logger.warn(
        `OpenSearch search failed, falling back to PostgreSQL: ${error.message}`,
      );

      // Fallback to PostgreSQL
      const where: any = {
        chatId: { in: chatIds },
        content: { contains: query, mode: 'insensitive' },
      };

      if (filters?.chatId) {
        if (!chatIds.includes(filters.chatId)) {
          return { messages: [], total: 0 };
        }
        where.chatId = filters.chatId;
      }

      const [messages, total] = await Promise.all([
        this.prisma.message.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
          },
        }),
        this.prisma.message.count({ where }),
      ]);

      return { messages, total };
    }
  }

  async getChatHistory(
    userId: string,
    chatId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    // Verify user has access to chat
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat || (chat.user1Id !== userId && chat.user2Id !== userId)) {
      throw new ForbiddenException('Access denied');
    }

    // Try OpenSearch first with fallback to PostgreSQL
    try {
      const result = await this.opensearch.getChatHistory(chatId, page, limit);

      this.logger.log(
        `OpenSearch returned ${result.total} messages for chat ${chatId}`,
      );
      return result;
    } catch (error) {
      this.logger.warn(
        `OpenSearch history failed, falling back to PostgreSQL: ${error.message}`,
      );

      // Fallback to PostgreSQL
      const [messages, total] = await Promise.all([
        this.prisma.message.findMany({
          where: { chatId },
          orderBy: { createdAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
          },
        }),
        this.prisma.message.count({ where: { chatId } }),
      ]);

      return { messages, total };
    }
  }
}

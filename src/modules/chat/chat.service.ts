import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async createChat(userId: string, otherUserId: string, listingId?: string) {
    // Ensure user1Id < user2Id for consistency
    const [user1Id, user2Id] = userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];

    // Check if chat already exists
    const existingChat = await this.prisma.chat.findUnique({
      where: {
        user1Id_user2Id_listingId: {
          user1Id,
          user2Id,
          listingId: listingId || '',
        },
      },
    });

    if (existingChat) {
      return existingChat;
    }

    return this.prisma.chat.create({
      data: {
        user1Id,
        user2Id,
        listingId,
      },
      include: {
        user1: { select: { id: true, name: true, avatarUrl: true } },
        user2: { select: { id: true, name: true, avatarUrl: true } },
        listing: listingId ? { select: { id: true, title: true, images: true } } : false,
      },
    });
  }

  async getUserChats(userId: string) {
    return this.prisma.chat.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
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

    // Mark messages as read if they were sent by the other user
    await this.prisma.message.updateMany({
      where: {
        chatId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

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

    return message;
  }

  async getUnreadCount(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
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
}

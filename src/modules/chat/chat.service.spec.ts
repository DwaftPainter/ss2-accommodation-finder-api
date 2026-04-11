import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { prismaMock } from '../../../test/mocks/prisma.mock';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    jest.clearAllMocks();
  });

  describe('createChat', () => {
    const userId = 'user-1';
    const otherUserId = 'user-2';
    const listingId = 'listing-1';

    it('should create new chat when it does not exist', async () => {
      const mockChat = {
        id: 'chat-1',
        user1Id: userId,
        user2Id: otherUserId,
        listingId,
        user1: { id: userId, name: 'User 1', avatarUrl: null },
        user2: { id: otherUserId, name: 'User 2', avatarUrl: null },
        listing: { id: listingId, title: 'Test Listing', images: [] },
      };

      prismaMock.chat.findUnique.mockResolvedValue(null);
      prismaMock.chat.create.mockResolvedValue(mockChat);

      const result = await service.createChat(userId, otherUserId, listingId);

      expect(prismaMock.chat.findUnique).toHaveBeenCalledWith({
        where: {
          user1Id_user2Id_listingId: {
            user1Id: userId,
            user2Id: otherUserId,
            listingId,
          },
        },
      });
      expect(prismaMock.chat.create).toHaveBeenCalled();
      expect(result).toEqual(mockChat);
    });

    it('should return existing chat if it already exists', async () => {
      const mockChat = {
        id: 'chat-1',
        user1Id: userId,
        user2Id: otherUserId,
        listingId,
      };

      prismaMock.chat.findUnique.mockResolvedValue(mockChat);

      const result = await service.createChat(userId, otherUserId, listingId);

      expect(prismaMock.chat.findUnique).toHaveBeenCalled();
      expect(prismaMock.chat.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockChat);
    });

    it('should handle chat without listingId', async () => {
      const mockChat = {
        id: 'chat-1',
        user1Id: userId,
        user2Id: otherUserId,
        listingId: '',
        user1: { id: userId, name: 'User 1', avatarUrl: null },
        user2: { id: otherUserId, name: 'User 2', avatarUrl: null },
        listing: false,
      };

      prismaMock.chat.findUnique.mockResolvedValue(null);
      prismaMock.chat.create.mockResolvedValue(mockChat);

      const result = await service.createChat(userId, otherUserId);

      // Service orders users: user1Id < user2Id
      expect(prismaMock.chat.create).toHaveBeenCalledWith({
        data: {
          user1Id: userId,
          user2Id: otherUserId,
          listingId: undefined,
        },
        include: {
          user1: { select: { id: true, name: true, avatarUrl: true } },
          user2: { select: { id: true, name: true, avatarUrl: true } },
          listing: false,
        },
      });
      expect(result).toEqual(mockChat);
    });

    it('should normalize user order (user1Id < user2Id)', async () => {
      const mockChat = {
        id: 'chat-1',
        user1Id: userId,
        user2Id: otherUserId,
        listingId,
      };

      prismaMock.chat.findUnique.mockResolvedValue(mockChat);

      await service.createChat(userId, otherUserId, listingId);

      // Since 'user-1' < 'user-2', the order should remain the same
      expect(prismaMock.chat.findUnique).toHaveBeenCalledWith({
        where: {
          user1Id_user2Id_listingId: {
            user1Id: userId,
            user2Id: otherUserId,
            listingId,
          },
        },
      });
    });
  });

  describe('getUserChats', () => {
    const userId = 'user-1';

    it('should return user chats with latest message', async () => {
      const mockChats = [
        {
          id: 'chat-1',
          user1Id: userId,
          user2Id: 'user-2',
          user1: { id: userId, name: 'User 1', avatarUrl: null },
          user2: { id: 'user-2', name: 'User 2', avatarUrl: null },
          listing: null,
          messages: [
            {
              id: 'msg-1',
              content: 'Hello',
              createdAt: new Date(),
              senderId: 'user-2',
              isRead: false,
            },
          ],
        },
      ];

      prismaMock.chat.findMany.mockResolvedValue(mockChats);

      const result = await service.getUserChats(userId);

      expect(prismaMock.chat.findMany).toHaveBeenCalledWith({
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
      expect(result).toEqual(mockChats);
    });

    it('should return empty array when user has no chats', async () => {
      prismaMock.chat.findMany.mockResolvedValue([]);

      const result = await service.getUserChats(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getChatMessages', () => {
    const userId = 'user-1';
    const chatId = 'chat-1';

    it('should return messages with pagination', async () => {
      const mockChat = {
        id: chatId,
        user1Id: userId,
        user2Id: 'user-2',
      };

      const mockMessages = [
        {
          id: 'msg-1',
          content: 'Hello',
          sender: { id: 'user-2', name: 'User 2', avatarUrl: null },
        },
      ];

      prismaMock.chat.findUnique.mockResolvedValue(mockChat);
      prismaMock.message.findMany.mockResolvedValue(mockMessages);
      prismaMock.message.count.mockResolvedValue(1);
      prismaMock.message.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.getChatMessages(userId, chatId, 0, 20);

      expect(prismaMock.chat.findUnique).toHaveBeenCalledWith({
        where: { id: chatId },
      });
      expect(prismaMock.message.findMany).toHaveBeenCalledWith({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
      expect(prismaMock.message.updateMany).toHaveBeenCalledWith({
        where: {
          chatId,
          senderId: { not: userId },
          isRead: false,
        },
        data: { isRead: true, readAt: expect.any(Date) },
      });
      expect(result.messages).toEqual(mockMessages);
      expect(result.meta.total).toBe(1);
      expect(result.meta.hasMore).toBe(false);
    });

    it('should throw ForbiddenException if user is not in chat', async () => {
      const mockChat = {
        id: chatId,
        user1Id: 'user-3',
        user2Id: 'user-4',
      };

      prismaMock.chat.findUnique.mockResolvedValue(mockChat);

      await expect(service.getChatMessages(userId, chatId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if chat does not exist', async () => {
      prismaMock.chat.findUnique.mockResolvedValue(null);

      await expect(service.getChatMessages(userId, chatId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should calculate hasMore correctly when more messages exist', async () => {
      const mockChat = {
        id: chatId,
        user1Id: userId,
        user2Id: 'user-2',
      };

      prismaMock.chat.findUnique.mockResolvedValue(mockChat);
      prismaMock.message.findMany.mockResolvedValue([]);
      prismaMock.message.count.mockResolvedValue(25);
      prismaMock.message.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.getChatMessages(userId, chatId, 0, 20);

      expect(result.meta.hasMore).toBe(true);
    });
  });

  describe('createMessage', () => {
    const chatId = 'chat-1';
    const senderId = 'user-1';
    const content = 'Hello!';

    it('should create message successfully', async () => {
      const mockChat = {
        id: chatId,
        user1Id: senderId,
        user2Id: 'user-2',
      };

      const mockMessage = {
        id: 'msg-1',
        chatId,
        senderId,
        content,
        sender: { id: senderId, name: 'User 1', avatarUrl: null },
      };

      prismaMock.chat.findUnique.mockResolvedValue(mockChat);
      prismaMock.$transaction.mockResolvedValue([mockMessage, mockChat]);

      const result = await service.createMessage(chatId, senderId, content);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockMessage);
    });

    it('should throw NotFoundException if chat not found', async () => {
      prismaMock.chat.findUnique.mockResolvedValue(null);

      await expect(
        service.createMessage(chatId, senderId, content),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not in chat', async () => {
      const mockChat = {
        id: chatId,
        user1Id: 'user-3',
        user2Id: 'user-4',
      };

      prismaMock.chat.findUnique.mockResolvedValue(mockChat);

      await expect(
        service.createMessage(chatId, senderId, content),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUnreadCount', () => {
    const userId = 'user-1';

    it('should return unread message count', async () => {
      const mockChats = [{ id: 'chat-1' }, { id: 'chat-2' }];

      prismaMock.chat.findMany.mockResolvedValue(mockChats);
      prismaMock.message.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(userId);

      expect(prismaMock.chat.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
        select: { id: true },
      });
      expect(prismaMock.message.count).toHaveBeenCalledWith({
        where: {
          chatId: { in: ['chat-1', 'chat-2'] },
          senderId: { not: userId },
          isRead: false,
        },
      });
      expect(result).toEqual({ count: 5 });
    });

    it('should return 0 when user has no chats', async () => {
      prismaMock.chat.findMany.mockResolvedValue([]);
      prismaMock.message.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(userId);

      expect(result).toEqual({ count: 0 });
    });
  });
});

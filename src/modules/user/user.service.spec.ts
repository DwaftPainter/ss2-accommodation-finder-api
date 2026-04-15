import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { prismaMock } from '../../../test/mocks/prisma.mock';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('getMe', () => {
    it('should return current user', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: new Date(),
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe('1');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.getMe('non-existent');

      expect(result).toBeNull();
    });

    it('should not include sensitive fields like password', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        avatarUrl: null,
        createdAt: new Date(),
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe('1');

      expect(result).not.toHaveProperty('password');
    });
  });

  describe('updateMe', () => {
    it('should update user profile', async () => {
      const updateData = {
        name: 'Updated Name',
        avatarUrl: 'https://example.com/new-avatar.jpg',
      };
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'Updated Name',
        avatarUrl: 'https://example.com/new-avatar.jpg',
      };
      prismaMock.user.update.mockResolvedValue(mockUser);

      const result = await service.updateMe('1', updateData);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should update only name', async () => {
      const updateData = { name: 'New Name' };
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'New Name',
        avatarUrl: 'https://example.com/avatar.jpg',
      };
      prismaMock.user.update.mockResolvedValue(mockUser);

      await service.updateMe('1', updateData);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
      });
    });

    it('should update only avatarUrl', async () => {
      const updateData = { avatarUrl: 'https://example.com/new.jpg' };
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/new.jpg',
      };
      prismaMock.user.update.mockResolvedValue(mockUser);

      await service.updateMe('1', updateData);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
        select: expect.any(Object),
      });
    });

    it('should throw error when updating non-existent user', async () => {
      const updateData = { name: 'New Name' };
      prismaMock.user.update.mockRejectedValue(new Error('User not found'));

      await expect(service.updateMe('non-existent', updateData)).rejects.toThrow('User not found');
    });

    it('should not return sensitive fields after update', async () => {
      const updateData = { name: 'New Name' };
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'New Name',
        avatarUrl: null,
      };
      prismaMock.user.update.mockResolvedValue(mockUser);

      const result = await service.updateMe('1', updateData);

      expect(result).not.toHaveProperty('password');
    });
  });
});

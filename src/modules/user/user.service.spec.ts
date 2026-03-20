import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { prismaMock } from '../../../test/mocks/prisma.mock';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('should return current user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'test@test.com',
    });

    const result = await service.getMe('1');

    expect(result.id).toBe('1');
  });
});

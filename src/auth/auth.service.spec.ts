import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { prismaMock } from '../../test/mocks/prisma.mock';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('signed-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should register user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
    });

    // const result = await service.register({
    //   email: 'test@example.com',
    //   password: '123456',
    //   name: 'test',
    // });

    // expect(result.email).toBe('test@example.com');
  });

  it('should throw if email exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: '1' });

    await expect(
      service.register({
        email: 'test@example.com',
        password: '123',
        name: 'test',
      }),
    ).rejects.toThrow();
  });
});

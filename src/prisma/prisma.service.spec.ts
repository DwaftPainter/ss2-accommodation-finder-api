import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let configService: jest.Mocked<ConfigService>;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('postgresql://localhost:5432/test'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create service with DATABASE_URL', async () => {
      mockConfigService.get.mockReturnValue('postgresql://localhost:5432/test');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const service = module.get<PrismaService>(PrismaService);

      expect(service).toBeDefined();
      expect(mockConfigService.get).toHaveBeenCalledWith('DATABASE_URL');
    });

    it('should throw error if DATABASE_URL is not set', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await expect(
        Test.createTestingModule({
          providers: [
            PrismaService,
            {
              provide: ConfigService,
              useValue: mockConfigService,
            },
          ],
        }).compile(),
      ).rejects.toThrow();
    });
  });

  describe('lifecycle hooks', () => {
    it('should have onModuleInit method', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const service = module.get<PrismaService>(PrismaService);

      expect(typeof service.onModuleInit).toBe('function');
    });

    it('should have onModuleDestroy method', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const service = module.get<PrismaService>(PrismaService);

      expect(typeof service.onModuleDestroy).toBe('function');
    });
  });
});

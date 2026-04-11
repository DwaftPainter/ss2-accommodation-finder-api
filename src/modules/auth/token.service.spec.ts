import { Test, TestingModule } from '@nestjs/testing';
import { TokenService } from './token.service';

// Define the injection token locally for tests
const UPSTASH_REDIS = 'UPSTASH_REDIS';

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('random-token-string'),
  }),
}));

describe('TokenService', () => {
  let service: TokenService;
  let redis: jest.Mocked<any>;

  const mockRedis = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn(),
    expire: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: UPSTASH_REDIS,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    redis = module.get(UPSTASH_REDIS);

    jest.clearAllMocks();
  });

  describe('createRefreshToken', () => {
    it('should create a refresh token', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await service.createRefreshToken('user-1');

      expect(result).toBe('random-token-string');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'refresh:random-token-string',
        'user-1',
        { ex: 60 * 60 * 24 * 30 },
      );
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'refresh:user:user-1',
        'random-token-string',
      );
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'refresh:user:user-1',
        60 * 60 * 24 * 30,
      );
    });
  });

  describe('resolveRefreshToken', () => {
    it('should return userId for valid token', async () => {
      mockRedis.get.mockResolvedValue('user-1');

      const result = await service.resolveRefreshToken('valid-token');

      expect(result).toBe('user-1');
      expect(mockRedis.get).toHaveBeenCalledWith('refresh:valid-token');
    });

    it('should return null for invalid token', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.resolveRefreshToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('rotateRefreshToken', () => {
    it('should delete old token and create new one', async () => {
      mockRedis.del.mockResolvedValue(1);
      mockRedis.srem.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await service.rotateRefreshToken('old-token', 'user-1');

      expect(mockRedis.del).toHaveBeenCalledWith('refresh:old-token');
      expect(mockRedis.srem).toHaveBeenCalledWith('refresh:user:user-1', 'old-token');
      expect(result).toBe('random-token-string');
    });
  });

  describe('deleteRefreshToken', () => {
    it('should delete refresh token', async () => {
      mockRedis.del.mockResolvedValue(1);
      mockRedis.srem.mockResolvedValue(1);

      await service.deleteRefreshToken('token-to-delete', 'user-1');

      expect(mockRedis.del).toHaveBeenCalledWith('refresh:token-to-delete');
      expect(mockRedis.srem).toHaveBeenCalledWith('refresh:user:user-1', 'token-to-delete');
    });
  });

  describe('deleteAllUserTokens', () => {
    it('should delete all user tokens', async () => {
      mockRedis.smembers.mockResolvedValue(['token1', 'token2', 'token3']);
      mockRedis.del.mockResolvedValue(1);

      await service.deleteAllUserTokens('user-1');

      expect(mockRedis.smembers).toHaveBeenCalledWith('refresh:user:user-1');
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:token1');
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:token2');
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:token3');
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:user:user-1');
    });

    it('should do nothing if user has no tokens', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      await service.deleteAllUserTokens('user-1');

      expect(mockRedis.smembers).toHaveBeenCalledWith('refresh:user:user-1');
      expect(mockRedis.del).not.toHaveBeenCalledWith('refresh:user:user-1');
    });
  });
});

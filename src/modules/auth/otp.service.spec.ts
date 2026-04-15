import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service';
// Define the injection token locally for tests
const UPSTASH_REDIS = 'UPSTASH_REDIS';

describe('OtpService', () => {
  let service: OtpService;
  let redis: jest.Mocked<any>;

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: UPSTASH_REDIS,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    redis = module.get(UPSTASH_REDIS);

    jest.clearAllMocks();
  });

  describe('generateOtp', () => {
    it('should generate a 6-digit OTP', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateOtp('user@example.com');

      expect(result).toMatch(/^\d{6}$/);
      expect(mockRedis.get).toHaveBeenCalledWith('otp:ratelimit:user@example.com');
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('otp:'),
        expect.any(String),
        { ex: 600 },
      );
    });

    it('should throw error if rate limited', async () => {
      mockRedis.get.mockResolvedValue('1');

      await expect(service.generateOtp('user@example.com')).rejects.toThrow(
        'Please wait before requesting another OTP',
      );
    });
  });

  describe('verifyOtp', () => {
    it('should return true for valid OTP', async () => {
      mockRedis.get.mockResolvedValue('123456');
      mockRedis.del.mockResolvedValue(1);

      const result = await service.verifyOtp('user@example.com', '123456');

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('otp:user@example.com');
      expect(mockRedis.del).toHaveBeenCalledWith('otp:user@example.com');
    });

    it('should return false if OTP does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.verifyOtp('user@example.com', '123456');

      expect(result).toBe(false);
    });

    it('should return false for invalid OTP', async () => {
      mockRedis.get.mockResolvedValue('654321');

      const result = await service.verifyOtp('user@example.com', '123456');

      expect(result).toBe(false);
    });
  });

  describe('deleteOtp', () => {
    it('should delete OTP', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.deleteOtp('user@example.com');

      expect(mockRedis.del).toHaveBeenCalledWith('otp:user@example.com');
    });
  });
});

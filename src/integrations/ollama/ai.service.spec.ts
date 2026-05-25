import { Test } from '@nestjs/testing';
import { AIService } from './ai.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ListingsService } from '../../modules/listing/listings.service';
import { OpensearchService } from '../opensearch/opensearch.service';

// Mock HttpService
const mockHttpService = {
  get: jest.fn(),
  post: jest.fn(),
};

// Mock ConfigService
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'ai.provider') return 'openai';
    if (key === 'ai.apiKey') return 'test-key';
    if (key === 'ai.model') return 'gpt-3.5-turbo';
    if (key === 'ai.baseUrl') return 'https://api.openai.com/v1';
    if (key === 'ollama.model') return 'gpt-oss:120b-cloud';
    if (key === 'ollama.host') return 'https://ollama.com';
    if (key === 'ollama.apiKey') return 'test-key';
    return undefined;
  }),
};

// Mock ListingsService
const mockListingsService = {
  findAll: jest.fn(),
};

const mockOpensearchService = {
  searchUserChats: jest.fn().mockResolvedValue({ messages: [], total: 0 }),
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
};

describe('AIService', () => {
  let service: AIService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ListingsService, useValue: mockListingsService },
        { provide: OpensearchService, useValue: mockOpensearchService },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get(AIService);
    (service as any).ollama = {
      list: jest.fn(),
      chat: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('testConnection', () => {
    it('should return true when AI service is reachable', async () => {
      (service as any).ollama.list.mockResolvedValue({ models: [] });

      const result = await service.testConnection();
      expect(result).toBe(true);
    });

    it('should return false when AI service is unreachable', async () => {
      (service as any).ollama.list.mockRejectedValue(
        new Error('Connection failed'),
      );

      const result = await service.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('generateResponse', () => {
    it('should generate a response based on user input', async () => {
      // Mock listings service response
      mockListingsService.findAll.mockResolvedValue({
        data: [
          {
            id: '1',
            title: 'Cozy Apartment',
            price: 1000,
            address: '123 Main St',
            utilities: ['wifi', 'parking'],
            area: 500,
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
        },
      });

      (service as any).ollama.chat.mockResolvedValue({
        message: { content: 'Here are some great options for you!' },
      });

      const message = {
        content: 'I need a place with wifi under £1200',
        role: 'user' as const,
      };

      const result = await service.generateResponse(message);

      expect(result).toEqual({
        content: 'Here are some great options for you!',
        sessionId: 'default',
        timestamp: expect.any(Date),
        relatedListings: [
          {
            id: '1',
            title: 'Cozy Apartment',
            price: 1000,
            address: '123 Main St',
            utilities: ['wifi', 'parking'],
            area: 500,
          },
        ],
      });
    });
  });
});

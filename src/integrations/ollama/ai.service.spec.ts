import { Test } from '@nestjs/testing';
import { AIService } from './ai.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ListingsService } from '../listing/listings.service';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';

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
    return undefined;
  }),
};

// Mock ListingsService
const mockListingsService = {
  findAll: jest.fn(),
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
      ],
    }).compile();

    service = module.get(AIService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('testConnection', () => {
    it('should return true when AI service is reachable', async () => {
      const mockResponse: AxiosResponse = {
        data: { data: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.testConnection();
      expect(result).toBe(true);
    });

    it('should return false when AI service is unreachable', async () => {
      mockHttpService.get.mockImplementation(() => {
        throw new Error('Connection failed');
      });

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

      // Mock AI API response
      const mockResponse: AxiosResponse = {
        data: {
          choices: [{
            message: {
              content: 'Here are some great options for you!'
            }
          }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

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
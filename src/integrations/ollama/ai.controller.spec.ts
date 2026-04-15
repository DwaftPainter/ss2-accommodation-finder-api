import { Test } from '@nestjs/testing';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { ChatMessageDto } from './dto/chat-message.dto';

// Mock AIService
const mockAIService = {
  generateResponse: jest.fn(),
  testConnection: jest.fn(),
};

describe('AIController', () => {
  let controller: AIController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AIController],
      providers: [
        { provide: AIService, useValue: mockAIService },
      ],
    }).compile();

    controller = module.get(AIController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should return a chat response', async () => {
      const message: ChatMessageDto = {
        content: 'Hello, I need a place with wifi',
        role: 'user',
      };

      const expectedResult = {
        content: 'I found some great options for you!',
        sessionId: 'default',
        timestamp: new Date(),
        relatedListings: [],
      };

      mockAIService.generateResponse.mockResolvedValue(expectedResult);

      const result = await controller.sendMessage(message);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const result = await controller.healthCheck();
      expect(result).toEqual({
        status: 'OK',
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      });
    });
  });

  describe('testConnection', () => {
    it('should return connection status', async () => {
      mockAIService.testConnection.mockResolvedValue(true);

      const result = await controller.testConnection();
      expect(result).toEqual({
        connected: true,
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      });
    });
  });
});
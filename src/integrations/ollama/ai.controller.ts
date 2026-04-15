import {
  Controller,
  Post,
  Body,
  Get,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AIService } from './ai.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatResponseDto } from './dto/chat-response.dto';

@Controller('ai-chat')
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(private readonly aiService: AIService) {}

  @Post('message')
  async sendMessage(@Body() message: ChatMessageDto): Promise<ChatResponseDto> {
    try {
      this.logger.log(`Received message from user: ${message.content}`);
      const response = await this.aiService.generateResponse(message);
      return response;
    } catch (error: any) {
      this.logger.error('Error processing message:', error.message);
      throw new HttpException(
        'Failed to process message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  async healthCheck(): Promise<{
    status: string;
    provider?: string;
    model?: string;
  }> {
    return {
      status: 'OK',
      provider: process.env.AI_PROVIDER || 'ollama',
      model: process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud',
    };
  }

  @Get('test-connection')
  async testConnection(): Promise<{
    connected: boolean;
    provider?: string;
    model?: string;
  }> {
    try {
      const isConnected = await this.aiService.testConnection();
      return {
        connected: isConnected,
        provider: process.env.AI_PROVIDER || 'ollama',
        model: process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud',
      };
    } catch (error: any) {
      this.logger.error('Connection test failed:', error.message);
      return {
        connected: false,
        provider: process.env.AI_PROVIDER || 'ollama',
        model: process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud',
      };
    }
  }
}

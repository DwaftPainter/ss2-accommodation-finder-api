import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ollama } from 'ollama';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { ListingsService } from 'src/modules/listing/listings.service';
import { QueryListingDto } from 'src/modules/listing/dto/query-listing.dto';

const ollama = new Ollama({
  host: 'https://ollama.com',
  headers: { Authorization: 'Bearer ' + "1c9058bfa1fd4588bd7274db967b58de.kn-WPpfEorEY5R3ouCVeBj6o" },
});

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly listingsService: ListingsService,
  ) {
    this.model =
      this.configService.get<string>('ollama.model') || 'gpt-oss:120b-cloud';
    this.logger.log(`AI service initialized with Ollama, model: ${this.model}`);
  }

  async testConnection(): Promise<boolean> {
    try {
      const list = await ollama.list();
      this.logger.log(
        `Ollama connected, models available: ${list.models.length}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to connect to Ollama: ${error.message}`);
      return false;
    }
  }

  async generateResponse(message: ChatMessageDto): Promise<ChatResponseDto> {
    try {
      const preferences = this.extractPreferences(message.content);

      const query: QueryListingDto = {};
      if (preferences.minPrice) query.minPrice = preferences.minPrice;
      if (preferences.maxPrice) query.maxPrice = preferences.maxPrice;
      if (preferences.utilities) query.utilities = preferences.utilities;

      const listings = await this.listingsService.findAll(query);
      const context = this.formatListingsContext(listings.data);
      const prompt = this.createPrompt(message.content, context);
      const response = await this.callAI(prompt);

      return {
        content: response,
        sessionId: message.sessionId || 'default',
        timestamp: new Date(),
        relatedListings: listings.data.slice(0, 3),
      };
    } catch (error: any) {
      this.logger.error('Error generating response:', error.message);
      throw new HttpException(
        `Failed to generate response: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private extractPreferences(content: string): any {
    const preferences: any = {};

    const priceMatch = content.match(
      /(?:£|\$|€)?(\d+(?:\.\d+)?)\s*(?:to|-)\s*(?:£|\$|€)?(\d+(?:\.\d+)?)/i,
    );
    if (priceMatch) {
      preferences.minPrice = parseFloat(priceMatch[1]);
      preferences.maxPrice = parseFloat(priceMatch[2]);
    }

    const utilities: string[] = [];
    if (
      content.toLowerCase().includes('wifi') ||
      content.toLowerCase().includes('internet')
    )
      utilities.push('wifi');
    if (content.toLowerCase().includes('parking')) utilities.push('parking');
    if (content.toLowerCase().includes('furnished'))
      utilities.push('furnished');
    if (content.toLowerCase().includes('unfurnished'))
      utilities.push('unfurnished');
    if (utilities.length > 0) preferences.utilities = utilities.join(',');

    return preferences;
  }

  private formatListingsContext(listings: any[]): string {
    if (!listings || listings.length === 0)
      return 'No listings available at the moment.';

    return (
      `I found ${listings.length} listings that might interest you:\n\n` +
      listings
        .slice(0, 3)
        .map(
          (listing, index) =>
            `${index + 1}. ${listing.title}\n` +
            `   Price: £${listing.price}/month\n` +
            `   Address: ${listing.address}\n` +
            `   Area: ${listing.area} sq ft\n` +
            `   Utilities: ${listing.utilities?.join(', ') || 'None specified'}\n`,
        )
        .join('\n')
    );
  }

  private createPrompt(userMessage: string, context: string): string {
    return `You are a helpful accommodation finder assistant. Your job is to help users find suitable accommodation based on their preferences.

${context ? `Available listings:\n${context}\n\n` : ''}User query: "${userMessage}"

Please provide a helpful response that:
1. Addresses the user's specific query
2. References relevant listings when appropriate
3. Provides helpful advice about finding accommodation
4. Maintains a friendly, professional tone
5. If no listings were found, suggest broadening the search criteria

Response:`;
  }

  private async callAI(prompt: string): Promise<string> {
    try {
      const response = await ollama.chat({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful accommodation finder assistant.',
          },
          { role: 'user', content: prompt },
        ],
      });

      return response.message.content.trim();
    } catch (error: any) {
      this.logger.error(`Failed to call Ollama: ${error.message}`, error.stack);
      return "I apologize, but I'm having trouble processing your request right now. Please try again later.";
    }
  }
}

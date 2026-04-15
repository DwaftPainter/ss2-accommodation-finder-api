import { Listing } from '@prisma/client';

export class ChatResponseDto {
  content: string;
  sessionId: string;
  timestamp: Date;
  relatedListings?: Partial<Listing>[];
}
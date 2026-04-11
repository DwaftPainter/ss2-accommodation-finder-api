import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChatDto {
  @ApiProperty({ description: 'ID of the other user in the chat' })
  @IsString()
  userId: string;

  @ApiPropertyOptional({ description: 'Listing ID if chat is about a specific listing' })
  @IsOptional()
  @IsString()
  listingId?: string;
}

export class SendMessageDto {
  @ApiProperty({ description: 'Chat ID' })
  @IsString()
  chatId: string;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  content: string;
}

export class MarkAsReadDto {
  @ApiProperty({ description: 'Message IDs to mark as read' })
  @IsString({ each: true })
  messageIds: string[];
}

export class GetChatMessagesDto {
  @ApiPropertyOptional({ description: 'Number of messages to skip', example: 0 })
  @IsOptional()
  @IsNumber()
  skip?: number = 0;

  @ApiPropertyOptional({ description: 'Number of messages to take', example: 20 })
  @IsOptional()
  @IsNumber()
  take?: number = 20;
}

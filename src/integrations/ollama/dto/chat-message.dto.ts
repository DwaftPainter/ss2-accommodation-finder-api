import { IsString, IsOptional, IsIn } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  content: string;

  @IsString()
  @IsIn(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system';

  @IsOptional()
  @IsString()
  sessionId?: string;
}
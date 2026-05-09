import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateChatDto, GetChatMessagesDto, SearchChatMessagesDto } from './dto/chat.dto';
import type { AuthenticatedRequest } from '../../common/types';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chats')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new chat or get existing chat' })
  async createChat(@Req() req: AuthenticatedRequest, @Body() dto: CreateChatDto) {
    return this.chatService.createChat(req.user.userId, dto.userId, dto.listingId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all user chats with last message' })
  async getUserChats(@Req() req: AuthenticatedRequest) {
    return this.chatService.getUserChats(req.user.userId);
  }

  @Get(':chatId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get chat messages' })
  async getChatMessages(
    @Req() req: AuthenticatedRequest,
    @Param('chatId') chatId: string,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
  ) {
    return this.chatService.getChatMessages(
      req.user.userId,
      chatId,
      skip ?? 0,
      take ?? 20,
    );
  }

  @Get('unread/count')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get total unread message count' })
  async getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.chatService.getUnreadCount(req.user.userId);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Search chat messages with OpenSearch (fallback to DB)' })
  async searchMessages(
    @Req() req: AuthenticatedRequest,
    @Query('q') query: string,
    @Query('chatId') chatId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.chatService.searchMessages(
      req.user.userId,
      query,
      { chatId },
      page ?? 1,
      limit ?? 20,
    );
  }

  @Get(':chatId/history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get chat history from OpenSearch (fallback to DB)' })
  async getChatHistory(
    @Req() req: AuthenticatedRequest,
    @Param('chatId') chatId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.chatService.getChatHistory(
      req.user.userId,
      chatId,
      page ?? 1,
      limit ?? 50,
    );
  }
}

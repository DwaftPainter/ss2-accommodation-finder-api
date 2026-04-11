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
import { CreateChatDto, GetChatMessagesDto } from './dto/chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chats')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new chat or get existing chat' })
  async createChat(@Req() req, @Body() dto: CreateChatDto) {
    return this.chatService.createChat(req.user.userId, dto.userId, dto.listingId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all user chats with last message' })
  async getUserChats(@Req() req) {
    return this.chatService.getUserChats(req.user.userId);
  }

  @Get(':chatId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get chat messages' })
  async getChatMessages(
    @Req() req,
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
  async getUnreadCount(@Req() req) {
    return this.chatService.getUnreadCount(req.user.userId);
  }
}

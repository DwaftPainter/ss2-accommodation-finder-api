import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';

interface AuthenticatedSocket extends Socket {
  user?: { userId: string };
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('ChatGateway');

  constructor(private chatService: ChatService) {}

  handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { chatId } = data;
    const userId = client.user?.userId;

    if (!userId) {
      return { error: 'Unauthorized' };
    }

    try {
      // Verify user has access to this chat
      await this.chatService.getChatMessages(userId, chatId, 0, 1);

      client.join(chatId);
      this.logger.log(`User ${userId} joined chat ${chatId}`);

      return { success: true, chatId };
    } catch (error) {
      return { error: 'Access denied' };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leave_chat')
  async handleLeaveChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { chatId } = data;
    client.leave(chatId);
    this.logger.log(`User ${client.user?.userId} left chat ${chatId}`);
    return { success: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { chatId: string; content: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { chatId, content } = data;
    const userId = client.user?.userId;

    if (!userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const message = await this.chatService.createMessage(
        chatId,
        userId,
        content,
      );

      // Broadcast to all clients in the chat room
      this.server.to(chatId).emit('new_message', {
        ...message,
        chatId,
      });

      // Notify the recipient if they're not in the room
      this.server.emit('notification', {
        type: 'new_message',
        chatId,
        message: {
          id: message.id,
          content: message.content,
          sender: message.sender,
          createdAt: message.createdAt,
        },
      });

      return { success: true, message };
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      return { error: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { chatId: string; isTyping: boolean },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { chatId, isTyping } = data;
    const userId = client.user?.userId;

    if (!userId) return;

    client.to(chatId).emit('user_typing', {
      chatId,
      userId,
      isTyping,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { chatId } = data;
    const userId = client.user?.userId;

    if (!userId) {
      return { error: 'Unauthorized' };
    }

    try {
      await this.chatService.getChatMessages(userId, chatId, 0, 1);

      // Notify other users in the chat
      client.to(chatId).emit('messages_read', {
        chatId,
        userId,
      });

      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }
}

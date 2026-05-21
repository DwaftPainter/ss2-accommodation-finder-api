import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { OpensearchModule } from '../../integrations/opensearch/opensearch.module';
import { NotificationsModule } from '../notification/notifications.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    OpensearchModule,
    NotificationsModule,
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, WsJwtGuard, PrismaService],
  exports: [ChatService],
})
export class ChatModule {}

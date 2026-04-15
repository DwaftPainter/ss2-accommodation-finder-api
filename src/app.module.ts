import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from 'src/modules/user/users.module';
import { ListingsModule } from 'src/modules/listing/listings.module';
import { ReviewsModule } from 'src/modules/review/reviews.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import configuration from './configs/configuration';
import { MailModule } from './integrations/mail/mail.module';
import { MapModule } from './integrations/map/map.module';
import { ChatModule } from './modules/chat/chat.module';
import { AIModule } from './integrations/ollama/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    MailModule,
    MapModule,
    ChatModule,
    AuthModule,
    UsersModule,
    ListingsModule,
    ReviewsModule,
    AIModule, // Add AI module for chat functionality 
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

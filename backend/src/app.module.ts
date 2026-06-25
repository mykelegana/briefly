import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LlmModule } from './modules/llm/llm.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HandoffModule } from './modules/handoff/handoff.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), LlmModule, DatabaseModule, HandoffModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

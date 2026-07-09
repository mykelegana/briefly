import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LlmModule } from './modules/llm/llm.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HandoffModule } from './modules/handoff/handoff.module';
import { SessionModule } from './modules/session/session.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CustomThrottlerGuard } from './guards/custom-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000, // 1 minute
          limit: 5, // 10 attempts in 1 minute
        },
      ],
    }),
    LlmModule,
    DatabaseModule,
    HandoffModule,
    SessionModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: CustomThrottlerGuard } // apply ThrottlerGuard globally
  ],
})
export class AppModule { }

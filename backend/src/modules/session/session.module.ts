import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [SessionController],
  providers: [SessionService],
  imports: [DatabaseModule]
})
export class SessionModule { }

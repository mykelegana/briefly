import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SaveSessionDto } from './dto/save-session.dto';
import { SessionService } from './session.service';

const TOKEN_HEADER = 'x-session-token';

@Controller('sessions')
export class SessionController {
  private readonly logger = new Logger(SessionController.name);

  constructor(private readonly sessionService: SessionService) { }

  // ── Resolve or create anonymous user from header token ────────────────────
  // localStorage on frontend → sent as x-session-token header
  // On first visit: no header → create user → return token in response header
  // On subsequent visits: header present → use directly, no DB call

  private async resolveUserId(req: Request, res: Response): Promise<string> {
    let userId = req.headers[TOKEN_HEADER] as string;

    if (!userId) {
      this.logger.log('No token found — creating new anonymous user');
      const user = await this.sessionService.createAnonymousUser();
      userId = user.id;
      res.setHeader(TOKEN_HEADER, userId);
      this.logger.log(`Token created and sent: ${userId}`);
    } else {
      this.logger.log(`Existing token received: ${userId}`);
    }

    return userId;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async saveSession(
    @Body() dto: SaveSessionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.resolveUserId(req, res);
    return this.sessionService.saveSession(userId, dto);
  }

  @Get()
  async getSessions(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.resolveUserId(req, res);
    return this.sessionService.getSessions(userId);
  }

  @Get(':id')
  async getSession(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.resolveUserId(req, res);
    return this.sessionService.getSession(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteSession(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.resolveUserId(req, res);
    return this.sessionService.deleteSession(userId, id);
  }
}
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

  private async resolveUserId(req: Request, res: Response): Promise<string> {
    let userId = req.headers[TOKEN_HEADER] as string;

    if (!userId) {
      // Fallback — should never happen since frontend always sends token
      this.logger.warn('No token in request — this should not happen');
      const user = await this.sessionService.createAnonymousUser();
      res.setHeader('x-session-token', user.id);
      return user.id;
    }
    // Ensure this user exists in DB — create if first time
    await this.sessionService.findOrCreateUser(userId);
    this.logger.log(`Token received: ${userId}`);
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
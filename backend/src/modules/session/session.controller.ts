import { Controller, Post, Get, Body, Param, Delete, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { SessionService } from './session.service';
import { SaveSessionDto } from './dto/save-session.dto';

const COOKIE_NAME = 'sessionToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
  // secure: true  ← uncomment in production (HTTPS only)
};

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) { }

  private async findAnonymousUser(@Req() req, @Res() res): Promise<string> {
    let userId = req.cookies?.[COOKIE_NAME];

    if (!userId) {
      const user = await this.sessionService.createAnonymousUser();
      userId = user.id;
      res.cookie(COOKIE_NAME, userId, COOKIE_OPTIONS);
    }

    return userId;
  }

  // ── POST /sessions ────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async saveSession(
    @Body() dto: SaveSessionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.findAnonymousUser(req, res);
    return this.sessionService.saveSession(userId, dto);
  }

  // ── GET /sessions ─────────────────────────────────────────────────────────

  @Get()
  async getSessions(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.findAnonymousUser(req, res);
    return this.sessionService.getSessions(userId);
  }

  // ── GET /sessions/:id ─────────────────────────────────────────────────────

  @Get(':id')
  async getSession(
    @Param('id') id: number,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.findAnonymousUser(req, res);
    return this.sessionService.getSession(userId, id);
  }

  // ── DELETE /sessions/:id ──────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteSession(
    @Param('id') id: number,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.findAnonymousUser(req, res);
    return this.sessionService.deleteSession(userId, id);
  }
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SaveSessionDto } from './dto/save-session.dto';

@Injectable()
export class SessionService {
    constructor(private readonly databaseService: DatabaseService) { }

    // ── Create anonymous user — called only on first visit ────────────────────

    async createAnonymousUser() {
        return this.databaseService.anonymousUser.create({
            data: {},
        });
    }

    // ── Save a new session ────────────────────────────────────────────────────

    async saveSession(anonymousUserId: string, dto: SaveSessionDto) {
        return this.databaseService.session.create({
            data: {
                anonymousUserId,
                rawInput: dto.rawInput,
                context: dto.context,
                handoff: dto.handoffOutput,
            },
        });
    }

    // ── Get all sessions for this user (list view — no heavy fields) ──────────

    async getSessions(anonymousUserId: string) {
        return this.databaseService.session.findMany({
            where: { anonymousUserId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                context: true, // frontend can pull projectName/problem from this
                createdAt: true,
            },
        });
    }

    // ── Get one full session — only if it belongs to this user ───────────────

    async getSession(anonymousUserId: string, sessionId: number) {
        const session = await this.databaseService.session.findUnique({
            where: { id: sessionId },
        });

        if (!session || session.anonymousUserId !== anonymousUserId) {
            throw new NotFoundException('Session not found.');
        }

        return session;
    }

    // ── Delete one session — only if it belongs to this user ─────────────────

    async deleteSession(anonymousUserId: string, sessionId: number) {
        const session = await this.databaseService.session.findUnique({
            where: { id: sessionId },
        });

        if (!session || session.anonymousUserId !== anonymousUserId) {
            throw new NotFoundException('Session not found.');
        }

        await this.databaseService.session.delete({
            where: { id: sessionId },
        });

        return { message: 'Session deleted.' };
    }
}
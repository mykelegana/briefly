import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SaveSessionDto } from './dto/save-session.dto';

@Injectable()
export class SessionService {
    private readonly logger = new Logger(SessionService.name);

    constructor(private readonly databaseService: DatabaseService) { }

    async createAnonymousUser() {
        const user = await this.databaseService.anonymousUser.create({ data: {} });
        this.logger.log(`Created anonymous user: ${user.id}`);
        return user;
    }

    async saveSession(anonymousUserId: string, dto: SaveSessionDto) {
        this.logger.log(`Saving session for user: ${anonymousUserId}`);
        const session = await this.databaseService.session.create({
            data: {
                anonymousUserId,
                rawInput: dto.rawInput,
                context: dto.context ?? {},
                handoff: dto.handoffOutput,
            },
        });
        this.logger.log(`Session saved: id=${session.id}`);
        return session;
    }

    async getSessions(anonymousUserId: string) {
        this.logger.log(`Getting sessions for user: ${anonymousUserId}`);
        return this.databaseService.session.findMany({
            where: { anonymousUserId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                context: true,
                handoff: true,    // needed for token savings calculation
                rawInput: true,   // needed for token savings calculation
                createdAt: true,
            },
        });
    }

    async getSession(anonymousUserId: string, sessionId: number) {
        const session = await this.databaseService.session.findUnique({
            where: { id: sessionId },
        });
        if (!session || session.anonymousUserId !== anonymousUserId) {
            throw new NotFoundException('Session not found.');
        }
        return session;
    }

    async deleteSession(anonymousUserId: string, sessionId: number) {
        const session = await this.databaseService.session.findUnique({
            where: { id: sessionId },
        });
        if (!session || session.anonymousUserId !== anonymousUserId) {
            throw new NotFoundException('Session not found.');
        }
        await this.databaseService.session.delete({ where: { id: sessionId } });
        return { message: 'Session deleted.' };
    }

    async findOrCreateUser(id: string) {
        const existing = await this.databaseService.anonymousUser.findUnique({
            where: { id },
        });
        if (!existing) {
            await this.databaseService.anonymousUser.create({ data: { id } });
            this.logger.log(`Created user from frontend token: ${id}`);
        }
        return existing;
    }
}
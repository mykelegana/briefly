import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
    private readonly logger = new Logger(CustomThrottlerGuard.name);

    protected throwThrottlingException(context: ExecutionContext, throttlerLimitDetail: any): Promise<void> {
        const request = context.switchToHttp().getRequest();
        const ip = request.ip;
        const url = request.url;

        // Log the event here
        this.logger.warn(`Rate limit exceeded for IP: ${ip} on route: ${url}. Limit: ${throttlerLimitDetail.limit}`);

        const convertToSeconds = throttlerLimitDetail.ttl / 1000; // Convert milliseconds ttl to seconds

        // Throw the default exception so the user still gets a 429 response
        throw new ThrottlerException(`Too Many Requests, only ${throttlerLimitDetail.limit} attempts for ${convertToSeconds} seconds`);
    }
}
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ExtractContextDto } from './dto/extract-context.dto';
import { LlmService } from './llm.service';
import { ApiBody } from '@nestjs/swagger';

@Controller('extract')
export class LlmController {
    constructor(private readonly llmService: LlmService) { }

    @Post()
    @HttpCode(HttpStatus.OK)
    @ApiBody({ type: ExtractContextDto })
    async extract(@Body() body: ExtractContextDto): Promise<Record<string, any>> {
        return this.llmService.extractContext(body.text);
    }
}
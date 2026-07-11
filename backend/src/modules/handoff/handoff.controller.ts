import { Body, Controller, Post } from '@nestjs/common';
import { GenerateHandoffDto } from './dto/generate.handoff.dto';
import { HandoffService } from './handoff.service';
import { ApiBody } from '@nestjs/swagger';

@Controller('handoff')
export class HandoffController {
    constructor(private handoffService: HandoffService) { }

    @Post('generate')
    @ApiBody({ type: GenerateHandoffDto })
    async generate(@Body() generateHandoffDto: GenerateHandoffDto) {
        return this.handoffService.generate(generateHandoffDto);
    }
}

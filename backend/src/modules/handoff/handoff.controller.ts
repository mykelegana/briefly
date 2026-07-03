import { Body, Controller, Post } from '@nestjs/common';
import { GenerateHandoffDto } from './dto/generate.handoff.dto';
import { HandoffService } from './handoff.service';

@Controller('handoff')
export class HandoffController {
    constructor(private handoffService: HandoffService) { }

    @Post('generate')
    async generate(@Body() generateHandoffDto: GenerateHandoffDto) {
        return this.handoffService.generate(generateHandoffDto);
    }
}

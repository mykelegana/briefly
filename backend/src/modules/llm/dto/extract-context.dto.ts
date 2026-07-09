import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExtractContextDto {
    @ApiProperty({ description: 'The coversation you want to extract.' })
    @IsString()
    @IsNotEmpty({ message: 'Conversation text must not be empty.' })
    @MinLength(50, {
        message: 'Conversation text is too short to extract context from.',
    })
    @MaxLength(500000, {
        message: 'Conversation text exceeds the maximum allowed length.',
    })
    text: string;
}
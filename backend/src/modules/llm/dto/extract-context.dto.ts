import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class ExtractContextDto {
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
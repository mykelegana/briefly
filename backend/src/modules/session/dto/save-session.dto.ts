import { IsString, IsNotEmpty, IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";


export class SaveSessionDto {

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    rawInput: string;

    @ApiProperty()
    @IsObject()
    @IsNotEmpty()
    context: Record<string, any>;  // the full ExtractedContextDto as JSON

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    handoffOutput: string;
}
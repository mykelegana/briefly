import { IsString, IsNotEmpty, IsObject } from "class-validator";


export class SaveSessionDto {
    @IsString()
    @IsNotEmpty()
    rawInput: string;

    @IsObject()
    @IsNotEmpty()
    context: Record<string, any>;  // the full ExtractedContextDto as JSON

    @IsString()
    @IsNotEmpty()
    handoffOutput: string;
}
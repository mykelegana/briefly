import { IsArray, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class GenerateHandoffDto {

    @ApiProperty()
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    techStack?: string[];

    @ApiProperty()
    @IsOptional()
    @IsString()
    projectName?: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    problem?: string;

    @ApiProperty()
    @IsArray()
    @IsOptional()
    triedAndFailed?: {
        approach: string,
        outcome: string
    }[];

    @ApiProperty()
    @IsOptional()
    @IsString()
    currentState?: string;

    @ApiProperty()
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    unresolvedQuestions?: string[];

    @ApiProperty()
    @IsOptional()
    @IsString()
    nextStep?: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    conversationSummary?: string;
}
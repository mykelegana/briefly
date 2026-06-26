import { IsArray, isArray, IsOptional, IsString } from "class-validator";

export class GenerateHandoffDto {

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    techStack?: string[];

    @IsOptional()
    @IsString()
    projectName?: string;

    @IsOptional()
    @IsString()
    problem?: string;

    @IsArray()
    @IsOptional()
    triedAndFailed?: {
        approach: string,
        outcome: string
    }[];

    @IsOptional()
    @IsString()
    currentState?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    unresolvedQuestions?: string[];

    @IsOptional()
    @IsString()
    nextStep?: string;

    @IsOptional()
    @IsString()
    conversationSummary?: string;
}
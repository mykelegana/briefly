import { Expose, Type } from 'class-transformer';
import {
    IsArray,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

export class TriedAndFailedItemDto {
    @Expose()
    @IsString()
    @IsNotEmpty()
    approach: string;

    @Expose()
    @IsString()
    @IsNotEmpty()
    outcome: string;
}

export class ExtractedContextDto {
    @Expose()
    @IsArray()
    @IsString({ each: true })
    techStack: string[];

    @Expose()
    @IsOptional()
    @IsString()
    projectName?: string | null;

    @Expose()
    @IsString()
    @IsNotEmpty()
    problem: string;

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TriedAndFailedItemDto)
    triedAndFailed: TriedAndFailedItemDto[];

    @Expose()
    @IsString()
    @IsNotEmpty()
    currentState: string;

    @Expose()
    @IsArray()
    @IsString({ each: true })
    unresolvedQuestions: string[];

    @Expose()
    @IsOptional()
    @IsString()
    nextStep: string | null;

    @Expose()
    @IsString()
    @IsNotEmpty()
    conversationSummary: string;
}
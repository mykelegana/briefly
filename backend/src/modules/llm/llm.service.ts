import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { ExtractedContextDto } from './dto/extracted-context.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-3.5-flash';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const GEMINI_URL = (apiKey: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are a technical context extractor for developer AI conversations.

Your ONLY job is to analyze a raw AI chat conversation and extract structured information from it.
You return ONLY valid JSON. No explanation, no markdown, no code fences, no preamble, no commentary. Just the raw JSON object.

You must always return every field listed below, even if some fields have no information.
Use null for missing scalar fields and empty arrays [] for missing array fields. Never omit a field.

Extract the following fields:

- techStack: array of strings. Every technology, framework, language, library, tool, cloud service, or database mentioned or clearly implied. Include versions if stated.
- projectName: string or null. The name of the project being worked on, if mentioned.
- problem: string. A clear 1-3 sentence summary of the core problem or goal being worked on. Be specific — include error names, module names, or system context if present.
- triedAndFailed: array of objects. Every solution, approach, or fix that was attempted and did not fully resolve the problem. Each object has: { "approach": string, "outcome": string }.
- currentState: string. What is the current state of the code or system at the end of the conversation — what works, what does not, where things were left off.
- unresolvedQuestions: array of strings. Any questions that were asked but not answered, or problems that were identified but not solved.
- nextStep: string or null. The most logical next action or thing to try, based on the conversation's final direction.
- conversationSummary: string. A 3-5 sentence plain-English summary of the entire conversation for someone reading it cold with no prior context.

Rules you must never break:
1. Return ONLY the JSON object. Nothing before it, nothing after it.
2. Never invent information that is not in the conversation.
3. If the conversation is vague or incomplete, extract what you can and use null or [] for gaps.
4. techStack must reflect what is actually used in the project, not general mentions or hypotheticals.
5. triedAndFailed entries must be actual attempts made in the conversation, not suggestions not yet tried.
6. problem must describe the specific technical situation, not a generic restatement like "the user had a problem."
`.trim();

const buildUserPrompt = (rawText: string): string =>
    `Here is the raw AI conversation to extract from:\n\n---START OF CONVERSATION---\n${rawText}\n---END OF CONVERSATION---\n\nExtract all fields and return the JSON object now.`;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class LlmService {
    private readonly logger = new Logger(LlmService.name);

    constructor(private readonly config: ConfigService) { }

    // ── Public entry point ────────────────────────────────────────────────────

    async extractContext(rawText: string): Promise<ExtractedContextDto> {
        let raw: string;

        try {
            this.logger.log('Attempting extraction via Gemini...');
            raw = await this.callGemini(rawText);
        } catch (geminiError) {
            this.logger.warn(
                `Gemini failed (${(geminiError as Error).message}), falling back to Groq...`,
            );

            try {
                raw = await this.callGroq(rawText);
            } catch (groqError) {
                this.logger.error(
                    `Groq also failed: ${(groqError as Error).message}`,
                );
                throw new InternalServerErrorException(
                    'Both AI providers failed to extract context. Please try again later.',
                );
            }
        }

        return this.parseAndValidate(raw);
    }

    // ── Gemini ────────────────────────────────────────────────────────────────

    private async callGemini(rawText: string): Promise<string> {
        const apiKey = this.config.get<string>('GEMINI_API_KEY');

        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not configured.');
        }

        const response = await fetch(GEMINI_URL(apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: SYSTEM_PROMPT }],
                },
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: buildUserPrompt(rawText) }],
                    },
                ],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: 'application/json',
                },
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini HTTP ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const text: string | undefined =
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('Gemini returned an empty or malformed response.');
        }

        return text;
    }

    // ── Groq (OpenAI-compatible) ──────────────────────────────────────────────

    private async callGroq(rawText: string): Promise<string> {
        const apiKey = this.config.get<string>('GROQ_API_KEY');

        if (!apiKey) {
            throw new Error('GROQ_API_KEY is not configured.');
        }

        const response = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                temperature: 0.1,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: buildUserPrompt(rawText) },
                ],
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Groq HTTP ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const text: string | undefined =
            data?.choices?.[0]?.message?.content;

        if (!text) {
            throw new Error('Groq returned an empty or malformed response.');
        }

        return text;
    }

    // ── Parse + Validate ──────────────────────────────────────────────────────

    private async parseAndValidate(raw: string): Promise<ExtractedContextDto> {
        let parsed: unknown;

        try {
            // Strip code fences if they slip through despite responseMimeType
            const cleaned = raw.replace(/```json|```/g, '').trim();
            parsed = JSON.parse(cleaned);
        } catch {
            this.logger.error(`Failed to parse AI response as JSON:\n${raw}`);
            throw new InternalServerErrorException(
                'AI returned a response that could not be parsed. Please try again.',
            );
        }

        const dto = plainToInstance(ExtractedContextDto, parsed, {
            excludeExtraneousValues: true,
        });

        try {
            await validateOrReject(dto);
        } catch (validationErrors) {
            this.logger.error(
                `Extracted context failed validation: ${JSON.stringify(validationErrors)}`,
            );
            throw new InternalServerErrorException(
                'AI returned an incomplete or invalid context structure. Please try again.',
            );
        }

        return dto;
    }
}
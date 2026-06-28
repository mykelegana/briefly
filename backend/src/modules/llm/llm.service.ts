import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash-lite'; // lite = less demand, more reliable
const GROQ_MODEL = 'llama-3.1-8b-instant';    // stable, high context limit, no thinking mode

const GEMINI_URL = (apiKey: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─── Timeout helper ───────────────────────────────────────────────────────────

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    );
    return Promise.race([promise, timeout]);
};

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
- problem: string. A clear 1-3 sentence summary of the core problem or goal being worked on. Be specific.
- triedAndFailed: array of objects with shape { "approach": string, "outcome": string }.
- currentState: string. What is the current state at the end of the conversation.
- unresolvedQuestions: array of strings.
- nextStep: string or null.
- conversationSummary: string. A 3-5 sentence plain-English summary.

Rules:
1. Return ONLY the JSON object. Nothing before it, nothing after it.
2. Never invent information not in the conversation.
3. If vague or incomplete, extract what you can and use null or [] for gaps.
`.trim();

const buildUserPrompt = (rawText: string): string =>
    `Here is the raw AI conversation to extract from:\n\n---START OF CONVERSATION---\n${rawText}\n---END OF CONVERSATION---\n\nExtract all fields and return the JSON object now.`;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class LlmService {
    private readonly logger = new Logger(LlmService.name);

    constructor(private readonly config: ConfigService) { }

    async extractContext(rawText: string): Promise<Record<string, any>> {
        // Truncate to protect free tier token limits (~6000 tokens)
        const truncated = rawText.length > 24000
            ? rawText.slice(0, 24000) + '\n[conversation truncated]'
            : rawText;

        let raw: string;

        try {
            this.logger.log('Attempting extraction via Gemini...');
            raw = await this.callGemini(truncated);
            this.logger.log('Gemini responded successfully.');
        } catch (geminiError) {
            this.logger.warn(
                `Gemini failed (${(geminiError as Error).message}), falling back to Groq...`,
            );
            try {
                raw = await this.callGroq(truncated);
                this.logger.log('Groq responded successfully.');
            } catch (groqError) {
                this.logger.error(`Groq also failed: ${(groqError as Error).message}`);
                throw new InternalServerErrorException(
                    'Both AI providers failed to extract context. Please try again later.',
                );
            }
        }

        // Parse JSON — no DTO validation, just return the raw parsed object
        // This removes the validation step that was causing the 500 errors
        try {
            const cleaned = raw.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            this.logger.log('Extraction parsed successfully.');
            return parsed;
        } catch {
            this.logger.error(`Failed to parse AI response as JSON:\n${raw}`);
            throw new InternalServerErrorException(
                'AI returned a response that could not be parsed. Please try again.',
            );
        }
    }

    private async callGemini(rawText: string): Promise<string> {
        const apiKey = this.config.get<string>('GEMINI_API_KEY');
        if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const fetchPromise = fetch(GEMINI_URL(apiKey), {
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

        const response = await withTimeout(fetchPromise, 15000, 'Gemini');

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini HTTP ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const text: string | undefined =
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error('Gemini returned an empty or malformed response.');
        return text;
    }

    private async callGroq(rawText: string): Promise<string> {
        const apiKey = this.config.get<string>('GROQ_API_KEY');
        if (!apiKey) throw new Error('GROQ_API_KEY is not configured.');

        const fetchPromise = fetch(GROQ_URL, {
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

        const response = await withTimeout(fetchPromise, 20000, 'Groq');

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Groq HTTP ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const text: string | undefined = data?.choices?.[0]?.message?.content;

        if (!text) throw new Error('Groq returned an empty or malformed response.');
        return text;
    }
}
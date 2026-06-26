import { Injectable } from '@nestjs/common';
import { GenerateHandoffDto } from './dto/generate.handoff.dto';


// ─── Helpers ──────────────────────────────────────────────────────────────────

const orNone = (value: string | null | undefined): string =>
    value?.trim() ? value.trim() : 'Not provided';

const formatList = (items: string[] | null | undefined): string => {
    if (!items || items.length === 0) return '  - Not provided';
    return items.map((item) => `  - ${item}`).join('\n');
};

const formatTriedAndFailed = (
    items: { approach: string; outcome: string }[] | null | undefined,
): string => {
    if (!items || items.length === 0) return '  - Not provided';
    return items
        .map(
            (item, i) =>
                `  ${i + 1}. Approach: ${item.approach}\n     Outcome: ${item.outcome}`,
        )
        .join('\n');
};

// ─── Prompt Template ─────────────────────────────────────────────────────────────────

const handoffPrompt = (handoffDto: GenerateHandoffDto): string => {
    return `
=== CONTEXT HANDOFF — Briefly ===
 
The following contains extracted context from a previous AI conversation.
Treat this as the current state of the project and continue from here.
 
IMPORTANT INSTRUCTIONS:
- Only use the information provided below. Do not invent or assume missing details.
- If a field says "Not provided", ask for clarification before proceeding.
- Do not restart the project or repeat steps already completed.
- Do not retry previously failed approaches unless you can explain why a variation would differ.
- Respect existing architecture and technology decisions.
- Focus on the Next Step and Unresolved Questions first.
- Provide practical guidance with code examples where helpful.
 
─────────────────────────────────
 
PROJECT NAME:
  ${orNone(handoffDto.projectName)}
 
TECH STACK:
${formatList(handoffDto.techStack)}
 
PROBLEM:
  ${orNone(handoffDto.problem)}
 
WHAT WAS TRIED (AND FAILED):
${formatTriedAndFailed(handoffDto.triedAndFailed)}
 
CURRENT STATE:
  ${orNone(handoffDto.currentState)}
 
UNRESOLVED QUESTIONS:
${formatList(handoffDto.unresolvedQuestions)}
 
NEXT STEP:
  ${orNone(handoffDto.nextStep)}
 
CONVERSATION SUMMARY:
  ${orNone(handoffDto.conversationSummary)}
 
=================================
Continue from here.
`.trim();
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class HandoffService {
    generate(ctx: GenerateHandoffDto): string {
        return handoffPrompt(ctx);
    }
}

<p align="center">
  <img src="frontend/docs/images/icon.png" alt="briefly" width="200"/>
</p>

# Briefly

A developer context handoff tool that compresses long AI coding conversations into structured project context, making it easy to continue work across AI assistants while reducing unnecessary token usage.

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![Gemini API](https://img.shields.io/badge/Gemini_API-8E75B2?style=flat&logo=google-gemini&logoColor=white)
![Groq API](https://img.shields.io/badge/Groq_API-F55036?style=flat)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-FF9900?style=flat&logo=amazon-aws&logoColor=232F3E)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=flat&logo=nginx&logoColor=white)

> As a free-tier AI user and backend developer, I frequently hit AI usage limits while building projects. Switching to another AI meant copying entire conversations just to restore context. While that worked, it also carried thousands of unnecessary tokens, consumed more of my limited AI usage, and often caused the next AI to process information it didn't actually need. I built Briefly to extract only the project context that matters, making it easier to continue coding across AI assistants without carrying the entire conversation.

## Core Features

- **AI Context Extraction** - Extracts the essential project context from long AI coding conversations, including the current state, technical decisions, previous attempts, and next steps.
- **Developer Handoff Generation** - Generates a structured prompt that allows developers to continue working in another AI assistant without re-explaining their project.
- **Cross-AI Compatibility** - Works with ChatGPT, Claude, Gemini, and other AI assistants by producing provider-agnostic handoff prompts.
- **Token Optimization** - Removes unnecessary conversation history to reduce token usage and maximize the available context window.
- **Rate Limiting** - Protects AI endpoints with IP-based request throttling to prevent abuse and preserve API quotas.
- **Session History** - Save and reopen previous project contexts without requiring user authentication.
- **Anonymous Sessions** - Persist project history using anonymous user IDs, allowing developers to continue where they left off without creating an account.

## Tech Stack

- **Runtime** - Node.js with NestJS framework
- **Languages** - TypeScript, JavaScript, HTML5, CSS3
- **Database** - PostgreSQL with Prisma ORM
- **Artificial Intelligence** - Gemini API, Groq API
- **Security** - @nestjs/throttler (Rate Limiting)
- **Deployment & Infrastructure** - AWS EC2, AWS RDS, Nginx (Reverse Proxy)
- **Containerization** - Docker & Docker Compose
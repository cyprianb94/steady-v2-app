# Coaching Knowledge Base

This directory contains the philosophical and practical foundations that shape Steady's AI coaching personality. Each file covers a distinct coaching principle or body of knowledge.

These are loaded into the AI coach's system prompt as compressed guidance — the coach never quotes them directly but internalises the principles.

## How to add new knowledge

1. Create a new `.ts` file in this directory
2. Export a `const` string with the compressed coaching principle
3. Import and add it to the `COACHING_KNOWLEDGE` array in `index.ts`

The knowledge is kept concise to fit within the token budget (4-6k total system prompt).

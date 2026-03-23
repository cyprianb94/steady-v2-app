/**
 * Model-agnostic LLM client.
 *
 * Abstracts the underlying model provider (Claude, Gemini, OpenAI, etc.)
 * behind a simple interface. Swap the implementation to change providers
 * without touching any calling code.
 */

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMClient {
  sendMessage(systemPrompt: string, messages: LLMMessage[]): Promise<string>;
}

// ---------------------------------------------------------------------------
// Anthropic (Claude) implementation
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';

export function createAnthropicClient(apiKey: string): LLMClient {
  const client = new Anthropic({ apiKey });

  return {
    async sendMessage(systemPrompt, messages) {
      const res = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        temperature: 0.7,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      const textBlock = res.content.find((b) => b.type === 'text');
      return textBlock?.text ?? '';
    },
  };
}

// ---------------------------------------------------------------------------
// Echo implementation — for development without an API key
// ---------------------------------------------------------------------------

export function createEchoClient(): LLMClient {
  return {
    async sendMessage(_systemPrompt, messages) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      return `[Echo] I heard: "${lastUser?.content ?? '(nothing)'}". This is a dev-mode echo response. Set ANTHROPIC_API_KEY (or another LLM provider key) to get real coaching responses.`;
    },
  };
}

// ---------------------------------------------------------------------------
// Factory — picks implementation based on available env vars
// ---------------------------------------------------------------------------

export function createLLMClient(): LLMClient {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return createAnthropicClient(anthropicKey);
  }

  console.warn('[LLM] No API key found. Using echo client for dev mode.');
  return createEchoClient();
}

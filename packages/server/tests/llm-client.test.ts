import { describe, it, expect } from 'vitest';
import { createEchoClient, createLLMClient } from '../src/lib/llm-client';

describe('llm-client', () => {
  describe('echo client', () => {
    it('echoes back the last user message', async () => {
      const client = createEchoClient();
      const reply = await client.sendMessage('system prompt', [
        { role: 'user', content: 'How was my run?' },
      ]);

      expect(reply).toContain('How was my run?');
      expect(reply).toContain('[Echo]');
    });

    it('handles empty message history', async () => {
      const client = createEchoClient();
      const reply = await client.sendMessage('system prompt', []);

      expect(reply).toContain('(nothing)');
    });

    it('picks the last user message from conversation history', async () => {
      const client = createEchoClient();
      const reply = await client.sendMessage('system prompt', [
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
        { role: 'user', content: 'Second question' },
      ]);

      expect(reply).toContain('Second question');
      expect(reply).not.toContain('First question');
    });
  });

  describe('createLLMClient factory', () => {
    it('returns echo client when no API key is set', () => {
      // In test env, ANTHROPIC_API_KEY is not set
      const client = createLLMClient();
      expect(client).toBeTruthy();
      // Verify it's the echo client by checking behavior
      return client.sendMessage('test', [{ role: 'user', content: 'hi' }])
        .then((reply) => expect(reply).toContain('[Echo]'));
    });
  });
});

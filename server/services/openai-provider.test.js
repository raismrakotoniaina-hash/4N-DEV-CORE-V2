import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIProvider } from '../providers/openai.js';

function makeProvider() {
  const client = {
    responses: {
      async create() {
        return {
          model: 'test-provider-model',
          output_text: 'ok',
          usage: {
            input_tokens: 100,
            input_tokens_details: {
              cached_tokens: 30,
              cache_write_tokens: 20
            },
            output_tokens: 10
          }
        };
      }
    }
  };
  return createOpenAIProvider({ apiKey: 'test-key', client });
}

test('OpenAI chat preserves cache-write token usage', async () => {
  const provider = makeProvider();
  const result = await provider.chat({ model: 'test-model', messages: [] });

  assert.equal(result.inputTokens, 100);
  assert.equal(result.cachedInputTokens, 30);
  assert.equal(result.cacheWriteInputTokens, 20);
  assert.equal(result.outputTokens, 10);
});

test('OpenAI coding preserves cache-write token usage', async () => {
  const provider = makeProvider();
  const result = await provider.coding({
    model: 'test-model',
    prompt: 'test prompt'
  });

  assert.equal(result.inputTokens, 100);
  assert.equal(result.cachedInputTokens, 30);
  assert.equal(result.cacheWriteInputTokens, 20);
  assert.equal(result.outputTokens, 10);
});

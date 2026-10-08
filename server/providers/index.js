import { createDemoProvider } from './demo.js';
import { createOpenAIProvider } from './openai.js';

export function createProvider(config) {
  if (config.aiProvider === 'demo') return createDemoProvider();
  if (config.aiProvider === 'openai') return createOpenAIProvider({ apiKey: config.openaiApiKey });
  return null;
}

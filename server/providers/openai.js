import OpenAI from 'openai';
import { createProviderError } from './base.js';

function normalizeError(error) {
  const status = Number(error?.status || error?.statusCode || 503);
  if (status === 401) return createProviderError('provider_auth_error', 'AI provider authentication failed.', 503);
  if (status === 429) return createProviderError('provider_rate_limited', 'AI provider rate limit reached. Please retry later.', 429);
  if (status >= 400 && status < 500) return createProviderError('provider_request_error', 'AI provider rejected the request.', 502);
  return createProviderError('provider_error', 'AI provider request failed.', 502);
}

function tokenUsage(usage) {
  return {
    inputTokens: Number(usage?.input_tokens || 0),
    outputTokens: Number(usage?.output_tokens || 0)
  };
}

export function createOpenAIProvider({ apiKey }) {
  if (!apiKey) throw createProviderError('provider_unavailable', 'OPENAI_API_KEY is not configured.', 503);
  const client = new OpenAI({ apiKey });

  return {
    id: 'openai',

    async chat({ model, messages, max_output_tokens, temperature }) {
      try {
        const response = await client.responses.create({
          model,
          input: messages,
          ...(max_output_tokens ? { max_output_tokens } : {}),
          ...(temperature !== undefined ? { temperature } : {})
        });
        const usage = tokenUsage(response.usage);
        return {
          model: response.model || model,
          message: { role: 'assistant', content: response.output_text || '' },
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens
        };
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async coding({ model, prompt, language, max_output_tokens }) {
      const instruction = language
        ? `Write production-quality ${language} code for the following request. Return the implementation directly and keep explanations concise.\n\n${prompt}`
        : `Write production-quality code for the following request. Return the implementation directly and keep explanations concise.\n\n${prompt}`;

      try {
        const response = await client.responses.create({
          model,
          input: instruction,
          ...(max_output_tokens ? { max_output_tokens } : {})
        });
        const usage = tokenUsage(response.usage);
        return {
          model: response.model || model,
          output: response.output_text || '',
          language: language || 'text',
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens
        };
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async image({ model, prompt, size, quality }) {
      try {
        const response = await client.images.generate({
          model,
          prompt,
          ...(size ? { size } : {}),
          ...(quality ? { quality } : {})
        });
        const images = (response.data || [])
          .filter((item) => item.b64_json)
          .map((item) => ({ url: `data:image/png;base64,${item.b64_json}` }));

        if (!images.length) throw createProviderError('provider_error', 'AI provider returned no image.', 502);

        return { model, images, size: size || 'auto' };
      } catch (error) {
        if (error.code && error.expose) throw error;
        throw normalizeError(error);
      }
    }
  };
}

const COSTS = Object.freeze({
  chat: 1,
  coding: 8,
  image: 50
});

const LIMITS = Object.freeze({
  chat: { input: 12000, output: 1200 },
  coding: { input: 24000, output: 3000 },
  image: { input: 12000 }
});

function serviceError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.expose = true;
  return error;
}

function textLength(value) {
  return String(value ?? '').length;
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw serviceError('invalid_request', 'messages must be a non-empty array.');
  }

  for (const message of messages) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string') {
      throw serviceError('invalid_parameter', 'Each message must contain a valid role and string content.');
    }
  }

  const total = messages.reduce((sum, message) => sum + textLength(message.content), 0);
  if (total > LIMITS.chat.input) {
    throw serviceError('invalid_parameter', 'Chat input exceeds the 12,000 character limit.');
  }
}

function validateMaxOutput(value, max) {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw serviceError('invalid_parameter', `max_output_tokens must be between 1 and ${max}.`);
  }
}

export function createAiService({ provider, creditsService, modelCatalog = [] }) {
  const resolveModel = (service, requested) => {
    const candidates = modelCatalog.filter((item) => item.service === service && item.status === 'active');
    if (!requested) return candidates[0]?.id || `demo-${service}`;
    if (candidates.length && !candidates.some((item) => item.id === requested)) {
      throw serviceError('invalid_model', `Model "${requested}" is not available for ${service}.`);
    }
    return requested;
  };

  async function charge(req, service, model, credits) {
    if (!creditsService) {
      throw serviceError('provider_unavailable', 'Core credit service is not configured.', 503);
    }

    try {
      return await creditsService.charge({
        workspaceId: req.auth.workspaceId,
        apiKeyId: req.auth.apiKeyId,
        service,
        model,
        credits,
        requestId: req.requestId,
        status: 'success'
      });
    } catch (error) {
      if (error.code === 'insufficient_credits') {
        error.status = 402;
        error.expose = true;
        error.message = 'Insufficient credits for this request.';
      }
      throw error;
    }
  }

  return {
    costs: COSTS,

    async chat(req, input) {
      validateMessages(input.messages);
      validateMaxOutput(input.max_output_tokens, LIMITS.chat.output);
      if (input.temperature !== undefined && (typeof input.temperature !== 'number' || input.temperature < 0 || input.temperature > 2)) {
        throw serviceError('invalid_parameter', 'temperature must be a number between 0 and 2.');
      }

      const model = resolveModel('chat', input.model);
      const result = await provider.chat({ ...input, model });
      await charge(req, 'chat', result.model, COSTS.chat);

      return {
        service: 'chat',
        model: result.model,
        usage: { credits: COSTS.chat, input_tokens: result.inputTokens, output_tokens: result.outputTokens },
        data: { message: result.message }
      };
    },

    async coding(req, input) {
      if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
        throw serviceError('invalid_request', 'prompt is required.');
      }
      if (textLength(input.prompt) > LIMITS.coding.input) {
        throw serviceError('invalid_parameter', 'Coding input exceeds the 24,000 character limit.');
      }
      validateMaxOutput(input.max_output_tokens, LIMITS.coding.output);

      const model = resolveModel('coding', input.model);
      const result = await provider.coding({ ...input, model });
      await charge(req, 'coding', result.model, COSTS.coding);

      return {
        service: 'coding',
        model: result.model,
        usage: { credits: COSTS.coding, input_tokens: result.inputTokens, output_tokens: result.outputTokens },
        data: { output: result.output, language: result.language }
      };
    },

    async image(req, input) {
      if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
        throw serviceError('invalid_request', 'prompt is required.');
      }
      if (textLength(input.prompt) > LIMITS.image.input) {
        throw serviceError('invalid_parameter', 'Image prompt exceeds the 12,000 character limit.');
      }

      const model = resolveModel('image', input.model);
      const result = await provider.image({ ...input, model });
      await charge(req, 'image', result.model, COSTS.image);

      return {
        service: 'image',
        model: result.model,
        usage: { credits: COSTS.image },
        data: { images: result.images }
      };
    }
  };
}

export { COSTS, LIMITS };

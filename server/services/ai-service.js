const LIMITS = Object.freeze({
  chat: { input: 12000, output: 1200 },
  coding: { input: 24000, output: 3000 },
  image: { input: 12000 }
});

const RESERVATION_INPUT_SAFETY_FACTOR = 1.5;
const CREDITS_PER_USD = 100;

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

function estimateInputTokens(value) {
  return Math.max(1, Math.ceil(textLength(value) / 4));
}

function calculateTokenCost(inputTokens, outputTokens, pricing) {
  const inputRate = Number(pricing?.input_cost_per_1m_usd || 0);
  const outputRate = Number(pricing?.output_cost_per_1m_usd || 0);
  const providerCostUsd =
    (Number(inputTokens) / 1_000_000) * inputRate +
    (Number(outputTokens) / 1_000_000) * outputRate;
  const marginMultiplier = Number(pricing?.margin_multiplier || 0);
  const chargedUsd = providerCostUsd * marginMultiplier;

  return {
    providerCostUsd,
    marginMultiplier,
    chargedUsd,
    chargedCredits: chargedUsd * CREDITS_PER_USD
  };
}

function calculateImageCost(pricing) {
  const providerCostUsd = Number(pricing?.image_cost_usd || 0);
  const marginMultiplier = Number(pricing?.margin_multiplier || 0);
  const chargedUsd = providerCostUsd * marginMultiplier;

  return {
    providerCostUsd,
    marginMultiplier,
    chargedUsd,
    chargedCredits: chargedUsd * CREDITS_PER_USD
  };
}

function positiveReservation(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw serviceError('pricing_not_configured', 'Core pricing is not configured for this model.', 503);
  }
  return amount;
}

export function createAiService({
  provider,
  creditsService,
  modelCatalog = [],
  providerModelCatalog = {}
}) {
  const resolveModel = (service, requested) => {
    const candidates = modelCatalog.filter((item) => item.service === service && item.status === 'active');
    const publicModel = requested || candidates[0]?.id;
    if (!publicModel) throw serviceError('invalid_model', `No model is configured for ${service}.`);
    if (!candidates.some((item) => item.id === publicModel)) {
      throw serviceError('invalid_model', `Model "${publicModel}" is not available for ${service}.`);
    }

    const providerModel = providerModelCatalog[publicModel];
    if (!providerModel) {
      throw serviceError('provider_unavailable', 'The selected Core model is not configured.', 503);
    }

    return { publicModel, providerModel };
  };

  async function getPricing(providerModel, service) {
    if (provider.id === 'demo') return null;

    const pricing = await creditsService.getPricing({
      provider: provider.id,
      providerModel,
      service
    });

    if (!pricing) {
      throw serviceError('pricing_not_configured', 'Core pricing is not configured for this model.', 503);
    }

    return pricing;
  }

  async function executeWithBilling(req, {
    service,
    publicModel,
    providerModel,
    reservationCredits,
    execute,
    getActualCharge,
    buildResponse
  }) {
    if (!creditsService) {
      throw serviceError('provider_unavailable', 'Core credit service is not configured.', 503);
    }

    if (provider.id === 'demo') {
      try {
        const result = await execute();
        await creditsService.recordNonBillableUsage({
          workspaceId: req.auth.workspaceId,
          apiKeyId: req.auth.apiKeyId,
          service,
          publicModel,
          provider: provider.id,
          providerModel,
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          requestId: req.requestId
        });
        return buildResponse(result, {
          chargedCredits: 0,
          chargedUsd: 0
        });
      } catch (error) {
        throw error;
      }
    }

    const reservation = await creditsService.reserve({
      workspaceId: req.auth.workspaceId,
      apiKeyId: req.auth.apiKeyId,
      requestId: req.requestId,
      credits: positiveReservation(reservationCredits),
      metadata: { service, publicModel }
    });

    try {
      const result = await execute();
      const charge = getActualCharge(result);

      if (charge.chargedCredits > Number(reservation.reserved_credits) + 0.000001) {
        throw serviceError('billing_reservation_exceeded', 'Actual usage exceeded the reserved credit amount.', 503);
      }

      await creditsService.settle({
        reservationId: reservation.id,
        workspaceId: req.auth.workspaceId,
        apiKeyId: req.auth.apiKeyId,
        requestId: req.requestId,
        service,
        publicModel,
        provider: provider.id,
        providerModel,
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
        providerCostUsd: charge.providerCostUsd,
        marginMultiplier: charge.marginMultiplier,
        chargedUsd: charge.chargedUsd,
        chargedCredits: charge.chargedCredits
      });

      return buildResponse(result, charge);
    } catch (error) {
      try {
        await creditsService.failReservation({
          reservationId: reservation.id,
          workspaceId: req.auth.workspaceId,
          reason: error.code || 'provider_error'
        });
      } catch {
        // Keep the original provider/billing error as the API result.
      }
      throw error;
    }
  }

  return {
    limits: LIMITS,

    async chat(req, input) {
      validateMessages(input.messages);
      validateMaxOutput(input.max_output_tokens, LIMITS.chat.output);

      if (
        input.temperature !== undefined &&
        (typeof input.temperature !== 'number' || input.temperature < 0 || input.temperature > 2)
      ) {
        throw serviceError('invalid_parameter', 'temperature must be a number between 0 and 2.');
      }

      const { publicModel, providerModel } = resolveModel('chat', input.model);
      const effectiveMaxOutput = input.max_output_tokens || LIMITS.chat.output;
      const pricing = await getPricing(providerModel, 'chat');
      const estimatedInput = Math.ceil(
        estimateInputTokens(JSON.stringify(input.messages)) * RESERVATION_INPUT_SAFETY_FACTOR
      );
      const reservationCharge = pricing
        ? calculateTokenCost(estimatedInput, effectiveMaxOutput, pricing).chargedCredits
        : 0;

      return executeWithBilling(req, {
        service: 'chat',
        publicModel,
        providerModel,
        reservationCredits: reservationCharge,
        execute: () => provider.chat({
          ...input,
          model: providerModel,
          max_output_tokens: effectiveMaxOutput
        }),
        getActualCharge: (result) => calculateTokenCost(result.inputTokens, result.outputTokens, pricing),
        buildResponse: (result, charge) => ({
          service: 'chat',
          model: publicModel,
          usage: {
            credits: charge.chargedCredits,
            input_tokens: result.inputTokens,
            output_tokens: result.outputTokens,
            total_tokens: (result.inputTokens || 0) + (result.outputTokens || 0)
          },
          data: { message: result.message }
        })
      });
    },

    async coding(req, input) {
      if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
        throw serviceError('invalid_request', 'prompt is required.');
      }
      if (textLength(input.prompt) > LIMITS.coding.input) {
        throw serviceError('invalid_parameter', 'Coding input exceeds the 24,000 character limit.');
      }
      validateMaxOutput(input.max_output_tokens, LIMITS.coding.output);

      const { publicModel, providerModel } = resolveModel('coding', input.model);
      const effectiveMaxOutput = input.max_output_tokens || LIMITS.coding.output;
      const pricing = await getPricing(providerModel, 'coding');
      const estimatedInput = Math.ceil(
        estimateInputTokens(input.prompt) * RESERVATION_INPUT_SAFETY_FACTOR
      );
      const reservationCharge = pricing
        ? calculateTokenCost(estimatedInput, effectiveMaxOutput, pricing).chargedCredits
        : 0;

      return executeWithBilling(req, {
        service: 'coding',
        publicModel,
        providerModel,
        reservationCredits: reservationCharge,
        execute: () => provider.coding({
          ...input,
          model: providerModel,
          max_output_tokens: effectiveMaxOutput
        }),
        getActualCharge: (result) => calculateTokenCost(result.inputTokens, result.outputTokens, pricing),
        buildResponse: (result, charge) => ({
          service: 'coding',
          model: publicModel,
          usage: {
            credits: charge.chargedCredits,
            input_tokens: result.inputTokens,
            output_tokens: result.outputTokens,
            total_tokens: (result.inputTokens || 0) + (result.outputTokens || 0)
          },
          data: { output: result.output, language: result.language }
        })
      });
    },

    async image(req, input) {
      if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
        throw serviceError('invalid_request', 'prompt is required.');
      }
      if (textLength(input.prompt) > LIMITS.image.input) {
        throw serviceError('invalid_parameter', 'Image prompt exceeds the 12,000 character limit.');
      }

      const { publicModel, providerModel } = resolveModel('image', input.model);
      const pricing = await getPricing(providerModel, 'image');
      const reservationCharge = pricing
        ? calculateImageCost(pricing).chargedCredits
        : 0;

      return executeWithBilling(req, {
        service: 'image',
        publicModel,
        providerModel,
        reservationCredits: reservationCharge,
        execute: () => provider.image({ ...input, model: providerModel }),
        getActualCharge: () => calculateImageCost(pricing),
        buildResponse: (result, charge) => ({
          service: 'image',
          model: publicModel,
          usage: { credits: charge.chargedCredits },
          data: { images: result.images }
        })
      });
    }
  };
}

export { LIMITS };

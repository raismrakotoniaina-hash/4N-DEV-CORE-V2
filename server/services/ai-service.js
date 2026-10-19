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

export function calculateTokenCost(inputTokens, outputTokens, providerPricing, customerPricing, cachedInputTokens = 0, cacheWriteInputTokens = 0) {
  const input = Number(inputTokens);
  const output = Number(outputTokens);
  const cached = Number(cachedInputTokens);
  const written = Number(cacheWriteInputTokens);
  if (!Number.isFinite(input) || !Number.isFinite(output) || !Number.isFinite(cached) || !Number.isFinite(written) || input < 0 || output < 0 || cached < 0 || written < 0 || cached + written > input) {
    throw serviceError('invalid_usage', 'Token usage must be finite non-negative numbers.');
  }
  if (providerPricing?.input_cost_per_1m_usd == null || providerPricing?.output_cost_per_1m_usd == null) {
    throw serviceError('pricing_not_configured', 'Provider input and output costs must be configured.', 503);
  }
  if (written > 0 && providerPricing.cache_write_cost_per_1m_usd == null) {
    throw serviceError('pricing_not_configured', 'Provider cache-write cost is not configured.', 503);
  }
  const providerInputRate = Number(providerPricing.input_cost_per_1m_usd);
  const providerCachedInputRate = Number(providerPricing.cached_input_cost_per_1m_usd ?? providerPricing.input_cost_per_1m_usd);
  const providerCacheWriteRate = Number(providerPricing.cache_write_cost_per_1m_usd ?? providerPricing.input_cost_per_1m_usd);
  const providerOutputRate = Number(providerPricing.output_cost_per_1m_usd);
  if (![providerInputRate, providerCachedInputRate, providerCacheWriteRate, providerOutputRate].every((rate) => Number.isFinite(rate) && rate >= 0)) {
    throw serviceError('pricing_not_configured', 'Provider pricing is invalid.', 503);
  }
  const providerCostUsd =
    ((input - cached - written) / 1_000_000) * providerInputRate +
    (cached / 1_000_000) * providerCachedInputRate +
    (written / 1_000_000) * providerCacheWriteRate +
    (output / 1_000_000) * providerOutputRate;
  if (customerPricing?.input_price_per_1m_usd == null || customerPricing?.output_price_per_1m_usd == null) {
    throw serviceError('customer_pricing_not_configured', 'Both 4N DEV input and output tariffs must be configured for this model.', 503);
  }
  if (written > 0 && customerPricing.cache_write_price_per_1m_usd == null) {
    throw serviceError('customer_pricing_not_configured', '4N DEV cache-write tariff is not configured for this model.', 503);
  }
  const customerInputRate = Number(customerPricing.input_price_per_1m_usd);
  const customerCachedInputRate = Number(customerPricing.cached_input_price_per_1m_usd ?? customerPricing.input_price_per_1m_usd);
  const customerCacheWriteRate = Number(customerPricing.cache_write_price_per_1m_usd ?? customerPricing.input_price_per_1m_usd);
  const customerOutputRate = Number(customerPricing.output_price_per_1m_usd);
  if (![customerInputRate, customerCachedInputRate, customerCacheWriteRate, customerOutputRate].every((rate) => Number.isFinite(rate) && rate >= 0)) {
    throw serviceError('customer_pricing_not_configured', '4N DEV customer tariff is not configured for this model.', 503);
  }
  const chargedUsd =
    ((input - cached - written) / 1_000_000) * customerInputRate +
    (cached / 1_000_000) * customerCachedInputRate +
    (written / 1_000_000) * customerCacheWriteRate +
    (output / 1_000_000) * customerOutputRate;
  const marginMultiplier = providerCostUsd > 0 ? chargedUsd / providerCostUsd : 0;
  return { providerCostUsd, marginMultiplier, chargedUsd, chargedCredits: chargedUsd * CREDITS_PER_USD };
}
export function calculateImageCost(providerPricing, customerPricing) {
  if (providerPricing?.image_cost_usd == null) {
    throw serviceError('pricing_not_configured', 'Provider image cost is not configured.', 503);
  }
  const providerCostUsd = Number(providerPricing.image_cost_usd);
  if (!Number.isFinite(providerCostUsd) || providerCostUsd < 0) {
    throw serviceError('pricing_not_configured', 'Provider image pricing is invalid.', 503);
  }
  if (customerPricing?.image_price_usd == null) {
    throw serviceError('customer_pricing_not_configured', '4N DEV image tariff is not configured.', 503);
  }
  const chargedUsd = Number(customerPricing.image_price_usd);
  if (!Number.isFinite(chargedUsd) || chargedUsd < 0) {
    throw serviceError('customer_pricing_not_configured', '4N DEV image tariff is not configured.', 503);
  }
  const marginMultiplier = providerCostUsd > 0 ? chargedUsd / providerCostUsd : 0;

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
  usdWalletRepository,
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

  async function getPricing(providerModel, publicModel, service) {
    if (provider.id === 'demo') return null;

    const [providerPricing, customerPricing] = await Promise.all([
      creditsService.getPricing({ provider: provider.id, providerModel, service }),
      creditsService.getCustomerPricing({ publicModel, service })
    ]);

    if (!providerPricing) {
      throw serviceError('pricing_not_configured', 'Provider cost is not configured for this model.', 503);
    }
    if (!customerPricing) {
      throw serviceError('customer_pricing_not_configured', '4N DEV customer tariff is not configured for this model.', 503);
    }

    return { providerPricing, customerPricing };
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
          cachedInputTokens: result.cachedInputTokens || 0,
          cacheWriteInputTokens: result.cacheWriteInputTokens || 0,
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

    if (!usdWalletRepository) {
      throw serviceError('billing_unavailable', 'USD wallet billing is not configured.', 503);
    }
    const reservation = await usdWalletRepository.reserve({
      workspaceId: req.auth.workspaceId,
      apiKeyId: req.auth.apiKeyId,
      requestId: req.requestId,
      amountUsd: positiveReservation(reservationCredits),
      metadata: { service, publicModel }
    });

    try {
      const result = await execute();
      const charge = getActualCharge(result);

      if (charge.chargedUsd > Number(reservation.reserved_usd) + 0.00000001) {
        throw serviceError('billing_reservation_exceeded', 'Actual usage exceeded the reserved USD amount.', 503);
      }

      await usdWalletRepository.settle({
        reservationId: reservation.id,
        workspaceId: req.auth.workspaceId,
        chargedUsd: charge.chargedUsd,
        metadata: {
          apiKeyId: req.auth.apiKeyId,
          requestId: req.requestId,
          service,
          publicModel,
          provider: provider.id,
          providerModel,
          inputTokens: result.inputTokens || 0,
          cachedInputTokens: result.cachedInputTokens || 0,
          cacheWriteInputTokens: result.cacheWriteInputTokens || 0,
          outputTokens: result.outputTokens || 0,
          providerCostUsd: charge.providerCostUsd,
          marginMultiplier: charge.marginMultiplier
        }
      });

      return buildResponse(result, charge);
    } catch (error) {
      try {
        await usdWalletRepository.release({
          reservationId: reservation.id,
          workspaceId: req.auth.workspaceId,
          metadata: { reason: error.code || 'provider_error' }
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
      const pricing = await getPricing(providerModel, publicModel, 'chat');
      const estimatedInput = Math.ceil(
        estimateInputTokens(JSON.stringify(input.messages)) * RESERVATION_INPUT_SAFETY_FACTOR
      );
      const reservationCharge = pricing
        ? calculateTokenCost(estimatedInput, effectiveMaxOutput, pricing.providerPricing, pricing.customerPricing).chargedUsd
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
        getActualCharge: (result) => calculateTokenCost(result.inputTokens, result.outputTokens, pricing.providerPricing, pricing.customerPricing, result.cachedInputTokens || 0, result.cacheWriteInputTokens || 0),
        buildResponse: (result, charge) => ({
          service: 'chat',
          model: publicModel,
          usage: {
            charged_usd: charge.chargedUsd,
            currency: 'USD',
            input_tokens: result.inputTokens,
            cached_input_tokens: result.cachedInputTokens || 0,
            cache_write_input_tokens: result.cacheWriteInputTokens || 0,
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
      const pricing = await getPricing(providerModel, publicModel, 'coding');
      const estimatedInput = Math.ceil(
        estimateInputTokens(input.prompt) * RESERVATION_INPUT_SAFETY_FACTOR
      );
      const reservationCharge = pricing
        ? calculateTokenCost(estimatedInput, effectiveMaxOutput, pricing.providerPricing, pricing.customerPricing).chargedUsd
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
        getActualCharge: (result) => calculateTokenCost(result.inputTokens, result.outputTokens, pricing.providerPricing, pricing.customerPricing),
        buildResponse: (result, charge) => ({
          service: 'coding',
          model: publicModel,
          usage: {
            charged_usd: charge.chargedUsd,
            currency: 'USD',
            input_tokens: result.inputTokens,
            cached_input_tokens: result.cachedInputTokens || 0,
            cache_write_input_tokens: result.cacheWriteInputTokens || 0,
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
      const pricing = await getPricing(providerModel, publicModel, 'image');
      const reservationCharge = pricing
        ? calculateImageCost(pricing.providerPricing, pricing.customerPricing).chargedUsd
        : 0;

      return executeWithBilling(req, {
        service: 'image',
        publicModel,
        providerModel,
        reservationCredits: reservationCharge,
        execute: () => provider.image({ ...input, model: providerModel }),
        getActualCharge: () => calculateImageCost(pricing.providerPricing, pricing.customerPricing),
        buildResponse: (result, charge) => ({
          service: 'image',
          model: publicModel,
          usage: { charged_usd: charge.chargedUsd, currency: 'USD' },
          data: { images: result.images }
        })
      });
    }
  };
}

export { LIMITS };

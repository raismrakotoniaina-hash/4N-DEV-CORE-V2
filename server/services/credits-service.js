export function createCreditsService(creditsRepository, usageRepository, pricingRepository) {
  return {
    async getCredits(workspaceId) {
      const account = await creditsRepository.getAccount(workspaceId);
      if (!account) {
        return {
          balance: 0,
          reserved_balance: 0,
          available_balance: 0,
          currency: 'USD'
        };
      }

      return {
        balance: account.balance,
        reserved_balance: account.reserved_balance,
        available_balance: account.available_balance,
        currency: 'USD'
      };
    },

    async getUsage(workspaceId, options) {
      return usageRepository.listByWorkspace(workspaceId, options);
    },

    async getPricing({ provider, providerModel, service }) {
      if (!pricingRepository) throw new Error('pricing_repository_not_configured');
      return pricingRepository.getActivePricing({ provider, providerModel, service });
    },

    async reserve({ workspaceId, apiKeyId, requestId, credits, metadata }) {
      try {
        return await creditsRepository.reserve({
          workspaceId,
          apiKeyId,
          requestId,
          credits,
          metadata
        });
      } catch (error) {
        if (error.code === 'insufficient_credits') {
          error.status = 402;
          error.expose = true;
          error.message = 'Insufficient credits for this request.';
        }
        throw error;
      }
    },

    async settle(payload) {
      try {
        return await creditsRepository.settle(payload);
      } catch (error) {
        if (error.code === 'insufficient_credits') {
          error.status = 402;
          error.expose = true;
          error.message = 'Insufficient credits for this request.';
        }
        throw error;
      }
    },

    async failReservation(payload) {
      return creditsRepository.failReservation(payload);
    },

    async recordNonBillableUsage(payload) {
      return creditsRepository.recordNonBillableUsage(payload);
    }
  };
}

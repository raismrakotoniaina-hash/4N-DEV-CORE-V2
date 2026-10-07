export function createCreditsService(creditsRepository, usageRepository) {
  return {
    async getCredits(workspaceId) {
      const account = await creditsRepository.getAccount(workspaceId);
      if (!account) {
        return { balance: 0, monthlyLimit: 0 };
      }
      return {
        balance: account.balance,
        monthlyLimit: account.monthly_limit
      };
    },

    async getUsage(workspaceId, options) {
      return usageRepository.listByWorkspace(workspaceId, options);
    },

    async charge({ workspaceId, apiKeyId, service, model, credits, requestId, status = 'completed', referenceId, metadata }) {
      return creditsRepository.recordUsage({
        workspaceId,
        apiKeyId,
        service,
        model,
        credits,
        requestId,
        status,
        referenceId,
        metadata
      });
    }
  };
}

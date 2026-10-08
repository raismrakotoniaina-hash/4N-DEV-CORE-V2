export function createBillingService(billingRepository) {
  if (!billingRepository) return null;

  return {
    listPackages(options = {}) {
      return billingRepository.listPackages(options);
    },

    getPackagePrice(options) {
      return billingRepository.getPackagePrice(options);
    },

    createPendingTransaction(options) {
      return billingRepository.createPendingTransaction(options);
    },

    getTransaction(options) {
      return billingRepository.getTransaction(options);
    },

    completeTransaction(options) {
      return billingRepository.completeTransaction(options);
    },

    updateStatus(options) {
      return billingRepository.updateStatus(options);
    }
  };
}

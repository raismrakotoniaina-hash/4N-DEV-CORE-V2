const ZOPAYO_OPERATION_URL = 'https://api.zopayo.com/operation/';

function asText(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function createZopayoProvider(config) {
  if (!config?.zopayoApiKey) return null;

  return {
    async createPayment({ amount, currency, reference, description }) {
      if (!isHttpsUrl(config.zopayoSuccessUrl) || !isHttpsUrl(config.zopayoErrorUrl)) {
        throw new Error('zopayo_return_urls_must_use_https');
      }

      const body = {
        cle_prive: config.zopayoApiKey,
        params_montant: 'false',
        montant: String(amount),
        devise: String(currency).toUpperCase(),
        id_relation: reference,
        raison: description || '4N DEV credits',
        url_emi: config.zopayoSuccessUrl,
        url_error_emi: config.zopayoErrorUrl
      };

      const response = await fetch(ZOPAYO_OPERATION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.payment_url) {
        const error = new Error('zopayo_payment_initialization_failed');
        error.status = response.status;
        error.providerResponse = data;
        throw error;
      }

      return {
        paymentUrl: data.payment_url,
        providerResponse: { payment_url: data.payment_url }
      };
    },

    parseWebhook(payload) {
      const raw = payload && typeof payload === 'object' ? payload : {};

      return {
        status: asText(raw.statut_general).toUpperCase(),
        reference: asText(raw.reference),
        merchantReference: asText(raw.id_relation),
        transactionId: asText(raw.id_transaction),
        amountPaid: raw.montant_paye ?? raw.montant,
        currency: asText(raw.devise).toUpperCase(),
        raw
      };
    },

    amountMatches(received, expected) {
      const a = Number(received);
      const b = Number(expected);
      return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.000001;
    }
  };
}

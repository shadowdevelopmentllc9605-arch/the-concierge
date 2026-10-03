import { base44 } from '@/api/base44Client';

export const BRIDGE_CONTRACT_VERSION = '2026-10-03';

function unwrap(response) {
  return response?.data ?? response;
}

async function invoke(name, payload = {}) {
  const response = await base44.functions.invoke(name, payload);
  const result = unwrap(response);

  if (result?.success === false) {
    throw new Error(result.error || `${name} failed.`);
  }

  return result;
}

export const sharedBackendBridge = {
  retryPending() {
    return invoke('retryIntegrationSyncs');
  },

  checkIn({ vendorId, locationId = '' }) {
    return invoke('storeVisit', {
      action: 'checkin',
      vendorId,
      locationId,
    });
  },

  requestTryOn({ checkinId, wishlistItemIds }) {
    return invoke('storeVisit', {
      action: 'tryOnRequest',
      checkinId,
      wishlistItemIds,
    });
  },

  checkoutVisit({ checkinId }) {
    return invoke('storeVisit', {
      action: 'checkout',
      checkinId,
    });
  },

  startOnlineCheckout({ saveCard, saveShippingAddress }) {
    return invoke('createStripeCheckout', {
      saveCard,
      saveShippingAddress,
    });
  },
};

export default sharedBackendBridge;

export function offlineBannerText(isSw: boolean, pendingCount: number): string {
  if (pendingCount > 0) {
    return isSw
      ? `Huna mtandao. Mauzo ${pendingCount} yamehifadhiwa na yatasawazishwa ukirudi mtandaoni.`
      : `You're offline. ${pendingCount} sale(s) saved locally and will sync when you're back online.`;
  }
  return isSw
    ? 'Huna mtandao — unaendelea na data iliyohifadhiwa kwenye kifaa chako.'
    : "You're offline — continuing with data saved on this device.";
}

export function syncSuccessText(isSw: boolean, count: number): string {
  if (count <= 0) {
    return isSw ? 'Data zimesasishwa kutoka seva.' : 'Data refreshed from server.';
  }
  return isSw
    ? `Imefanikiwa! Mauzo ${count} yamesawazishwa na seva.`
    : `Success! ${count} sale(s) synced to the server.`;
}

export function syncPartialText(isSw: boolean, processed: number, failed: number): string {
  return isSw
    ? `Mauzo ${processed} yamesawazishwa. ${failed} bado yanasubiri — jaribu tena ukirudi mtandaoni.`
    : `${processed} sale(s) synced. ${failed} still pending — try again when online.`;
}

export function saleQueuedOfflineText(isSw: boolean): string {
  return isSw
    ? 'Mauzo yamehifadhiwa kwenye kifaa chako. Yatasawazishwa moja kwa moja ukirudi mtandaoni.'
    : 'Sale saved on this device. It will sync automatically when you\'re back online.';
}

export function mutationQueuedText(isSw: boolean, entityType: string): string {
  const labels: Record<string, { sw: string; en: string }> = {
    product: { sw: 'Bidhaa imehifadhiwa', en: 'Product saved locally' },
    customer: { sw: 'Mteja amehifadhiwa', en: 'Customer saved locally' },
    stock: { sw: 'Mabadiliko ya stoo yamehifadhiwa', en: 'Stock change saved locally' },
    sale: { sw: 'Mauzo yamehifadhiwa', en: 'Sale saved locally' },
  };
  const label = labels[entityType] ?? { sw: 'Imehifadhiwa', en: 'Saved locally' };
  const prefix = isSw ? label.sw : label.en;
  return isSw
    ? `${prefix} — itasawazishwa ukirudi mtandaoni.`
    : `${prefix} — will sync when you're back online.`;
}

export function sessionExpiredText(isSw: boolean): string {
  return isSw
    ? 'Kipindi chako kimeisha. Tafadhali ingia tena ili kuendelea.'
    : 'Your session has expired. Please sign in again to continue.';
}

export function loadingShopText(isSw: boolean): string {
  return isSw ? 'Inapakia duka lako…' : 'Loading your shop…';
}

export function backOnlineText(isSw: boolean): string {
  return isSw ? 'Umerudi mtandaoni — data zinasawazishwa…' : 'Back online — syncing your data…';
}

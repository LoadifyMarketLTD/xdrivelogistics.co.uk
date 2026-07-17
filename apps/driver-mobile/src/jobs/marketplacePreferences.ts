import AsyncStorage from '@react-native-async-storage/async-storage';

export type MarketplacePreferences = {
  savedJobIds: string[];
  hiddenJobIds: string[];
  destinationPriorityEnabled: boolean;
  destinationRadiusMiles: 10 | 20 | 30;
};

const emptyPreferences: MarketplacePreferences = {
  savedJobIds: [],
  hiddenJobIds: [],
  destinationPriorityEnabled: true,
  destinationRadiusMiles: 10,
};

function storageKey(email: string) {
  return `xdrive:marketplace:${email.trim().toLowerCase() || 'anonymous'}`;
}

function normalize(value: unknown): MarketplacePreferences {
  if (!value || typeof value !== 'object') return emptyPreferences;
  const input = value as Partial<MarketplacePreferences>;
  return {
    savedJobIds: Array.isArray(input.savedJobIds) ? [...new Set(input.savedJobIds.map(String))] : [],
    hiddenJobIds: Array.isArray(input.hiddenJobIds) ? [...new Set(input.hiddenJobIds.map(String))] : [],
    destinationPriorityEnabled: input.destinationPriorityEnabled !== false,
    destinationRadiusMiles: input.destinationRadiusMiles === 20 || input.destinationRadiusMiles === 30 ? input.destinationRadiusMiles : 10,
  };
}

export async function loadMarketplacePreferences(email: string) {
  const stored = await AsyncStorage.getItem(storageKey(email));
  if (!stored) return emptyPreferences;
  try {
    return normalize(JSON.parse(stored));
  } catch {
    return emptyPreferences;
  }
}

export async function saveMarketplacePreferences(email: string, preferences: MarketplacePreferences) {
  await AsyncStorage.setItem(storageKey(email), JSON.stringify(normalize(preferences)));
}

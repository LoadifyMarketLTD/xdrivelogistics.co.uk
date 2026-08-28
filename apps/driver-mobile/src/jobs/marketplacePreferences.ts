import AsyncStorage from '@react-native-async-storage/async-storage';

export type DestinationRadiusMiles = 10 | 20 | 30 | 50 | 100 | 150 | 200 | 300;

export type MarketplacePreferences = {
  savedJobIds: string[];
  hiddenJobIds: string[];
  destinationPriorityEnabled: boolean;
  destinationRadiusMiles: DestinationRadiusMiles;
};

const emptyPreferences: MarketplacePreferences = {
  savedJobIds: [],
  hiddenJobIds: [],
  destinationPriorityEnabled: true,
  destinationRadiusMiles: 10,
};

const destinationRadiusOptions = new Set<DestinationRadiusMiles>([10, 20, 30, 50, 100, 150, 200, 300]);

function storageKey(email: string) {
  return `xdrive:marketplace:${email.trim().toLowerCase() || 'anonymous'}`;
}

function normalize(value: unknown): MarketplacePreferences {
  if (!value || typeof value !== 'object') return emptyPreferences;
  const input = value as Partial<MarketplacePreferences>;
  const radius = Number(input.destinationRadiusMiles);
  const destinationRadiusMiles = destinationRadiusOptions.has(radius as DestinationRadiusMiles)
    ? radius as DestinationRadiusMiles
    : 10;
  return {
    savedJobIds: Array.isArray(input.savedJobIds) ? [...new Set(input.savedJobIds.map(String))] : [],
    hiddenJobIds: Array.isArray(input.hiddenJobIds) ? [...new Set(input.hiddenJobIds.map(String))] : [],
    destinationPriorityEnabled: input.destinationPriorityEnabled !== false,
    destinationRadiusMiles,
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

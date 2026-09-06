import * as SecureStore from 'expo-secure-store';

const chunkSize = 1800;
const manifestSuffix = '.__xdrive_chunks';

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function manifestKey(key: string) {
  return `${key}${manifestSuffix}`;
}

function chunkKey(key: string, index: number) {
  return `${key}${manifestSuffix}.${index}`;
}

async function readChunkCount(key: string) {
  const raw = await SecureStore.getItemAsync(manifestKey(key));
  const count = Number(raw ?? 0);
  return Number.isInteger(count) && count > 0 && count < 100 ? count : 0;
}

async function clearChunks(key: string, knownCount?: number) {
  const count = knownCount ?? await readChunkCount(key);
  await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(chunkKey(key, index))));
  await SecureStore.deleteItemAsync(manifestKey(key));
}

export async function getChunkedSecureItem(key: string) {
  const count = await readChunkCount(key);
  if (count > 0) {
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))),
    );
    if (chunks.some((chunk) => chunk == null)) {
      await clearChunks(key, count);
      return null;
    }
    return chunks.join('');
  }

  // Backward-compatible read for values written before chunking was introduced.
  return SecureStore.getItemAsync(key);
}

export async function setChunkedSecureItem(key: string, value: string) {
  const previousCount = await readChunkCount(key);
  await clearChunks(key, previousCount);
  await SecureStore.deleteItemAsync(key);

  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += chunkSize) {
    chunks.push(value.slice(offset, offset + chunkSize));
  }

  if (chunks.length === 0) chunks.push('');

  await Promise.all(
    chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk, secureOptions)),
  );
  await SecureStore.setItemAsync(manifestKey(key), String(chunks.length), secureOptions);
}

export async function removeChunkedSecureItem(key: string) {
  const count = await readChunkCount(key);
  await clearChunks(key, count);
  await SecureStore.deleteItemAsync(key);
}

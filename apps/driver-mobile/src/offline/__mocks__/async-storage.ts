// In-memory AsyncStorage mock with per-test isolation via clear().
const store = new Map<string, string>();

const AsyncStorage = {
  getItem: jest.fn(async (key: string) => store.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { store.delete(key); }),
  clear: jest.fn(async () => { store.clear(); }),
  /** Test helper — wipes the in-memory store and clears call history. */
  __reset() {
    store.clear();
    jest.clearAllMocks();
  },
};

export default AsyncStorage;

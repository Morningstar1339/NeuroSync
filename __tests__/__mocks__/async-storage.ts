const storage: Record<string, string> = {};

const AsyncStorage = {
  getItem: jest.fn(async (key: string): Promise<string | null> => {
    return storage[key] ?? null;
  }),
  
  setItem: jest.fn(async (key: string, value: string): Promise<void> => {
    storage[key] = value;
  }),
  
  removeItem: jest.fn(async (key: string): Promise<void> => {
    delete storage[key];
  }),
  
  getAllKeys: jest.fn(async (): Promise<string[]> => {
    return Object.keys(storage);
  }),
  
  multiRemove: jest.fn(async (keys: string[]): Promise<void> => {
    keys.forEach(key => delete storage[key]);
  }),
  
  multiGet: jest.fn(async (keys: string[]): Promise<[string, string | null][]> => {
    return keys.map(key => [key, storage[key] ?? null]);
  }),
  
  clear: jest.fn(async (): Promise<void> => {
    Object.keys(storage).forEach(key => delete storage[key]);
  }),

  _getStorage: () => storage,
  _clearStorage: () => {
    Object.keys(storage).forEach(key => delete storage[key]);
  },
};

export default AsyncStorage;

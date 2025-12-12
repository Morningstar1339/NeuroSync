import { resetMockDatabase, getMockDatabase } from './__mocks__/expo-sqlite';
import AsyncStorage from './__mocks__/async-storage';

const initDb = async () => {
  const db = await import('../database/database');
  db.resetDatabaseState();
  getMockDatabase();
  await db.initializeDatabaseWithRetry(1, 0);
};

beforeEach(async () => {
  resetMockDatabase();
  AsyncStorage._clearStorage();
  jest.clearAllMocks();
  await initDb();
});

afterAll(() => {
  resetMockDatabase();
});

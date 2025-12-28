module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^expo-sqlite$': '<rootDir>/__tests__/__mocks__/expo-sqlite.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__tests__/__mocks__/async-storage.ts',
    '^expo-device$': '<rootDir>/__tests__/__mocks__/expo-device.ts',
    '^expo-constants$': '<rootDir>/__tests__/__mocks__/expo-constants.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
        target: 'ES2020',
        lib: ['ES2020'],
        baseUrl: '.',
        paths: {
          '@/*': ['./*']
        }
      }
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'database/**/*.ts',
    'utils/**/*.ts',
    '!**/*.d.ts',
  ],
  verbose: true,
};

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/src/offline/__mocks__/async-storage.ts',
    '^expo-network$': '<rootDir>/src/offline/__mocks__/expo-network.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: false } }],
  },
};

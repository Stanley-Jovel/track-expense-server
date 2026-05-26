import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^buffer-equal-constant-time$': '<rootDir>/lib/buffer-equal-constant-time-shim.js',
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/.claude/'],
  testTimeout: 45000,
};

export default config;

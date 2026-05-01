/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'src/controllers/riskController.ts',
    'src/middlewares/auth.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/middlewares/auth.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './src/controllers/riskController.ts': {
      branches: 90,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};

export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/wasm/**',
  ],
  // Don't try to transform WASM or model files
  transformIgnorePatterns: [
    'node_modules/(?!(@babylonjs)/)',
  ],
  // Ignore duplicate WASM package.json files
  modulePathIgnorePatterns: ['<rootDir>/public/wasm/', '<rootDir>/src/wasm/package.json'],
};

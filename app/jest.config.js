module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  moduleNameMapper: {
    '^.*/utils/emailSender$': '<rootDir>/tests/mocks/emailSender.js',
  },
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 15000,
};

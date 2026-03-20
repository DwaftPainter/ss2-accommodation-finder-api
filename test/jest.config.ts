export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',

  roots: ['<rootDir>/src', '<rootDir>/test'],

  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],

  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
};

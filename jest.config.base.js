/** Shared jest config for every NestJS service in this repo.
 *  Services extend it so the settings live in one place. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '\\.module\\.ts$', 'main\\.ts$'],
};

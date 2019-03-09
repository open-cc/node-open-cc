module.exports = {
  verbose: true,
  testEnvironment: 'node',
  transform: {
    "^.+\\.js$": 'babel-jest',
    "^.+\\.ts$": 'ts-jest'
  },
  setupFiles: ['<rootDir>/../api-container/jestSetup.js'],
  moduleFileExtensions: [
    'js',
    'ts',
    'node'
  ],
  testRegex: '.*\\.test\\.(js|ts)$',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js'
  ]
};

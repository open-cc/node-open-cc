module.exports = {
  verbose: true,
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/../api-container/jestSetup.js'],
  moduleFileExtensions: [
    'js',
    'node'
  ],
  testRegex: '.*\\.test\\.js$',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js'
  ]
};

module.exports = {
  verbose: true,
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jestSetup.js'],
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

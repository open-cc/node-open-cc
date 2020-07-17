module.exports = {
  verbose: true,
  testEnvironment: 'node',
  transform: {
    "^.+\\.js$": 'babel-jest',
    "^.+\\.ts$": 'ts-jest'
  },
  globals: {
    'ts-jest': {
      diagnostics: {
        warnOnly: true
      }
    }
  },
  moduleFileExtensions: [
    'js',
    'ts',
    'node'
  ],
  testRegex: '.*\\.test\\.(js|ts)$',
  testPathIgnorePatterns: ['/dist/', '/node_modules/'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts'
  ]
};

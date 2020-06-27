module.exports = {
  verbose: true,
  testEnvironment: 'node',
  transform: {
    "^.+\\.js$": 'babel-jest',
    "^.+\\.ts$": 'ts-jest'
  },
  moduleFileExtensions: [
    'js',
    'ts',
    'node'
  ],
  testRegex: '.*\\.test\\.(js|ts)$',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts'
  ]
};

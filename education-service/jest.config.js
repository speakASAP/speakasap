const base = require('../jest.config.base');
module.exports = {
  ...base,
  rootDir: '.',
  testRegex: '(src|prisma)/.*\\.spec\\.ts$',
};

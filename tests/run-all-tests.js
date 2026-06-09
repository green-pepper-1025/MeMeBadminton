const { readdirSync } = require('fs');
const { join } = require('path');

const testsDir = join(__dirname, '..', 'temp', 'test-dist', 'tests');
const tests = readdirSync(testsDir)
    .filter((file) => file.endsWith('.test.js'))
    .sort();

for (const test of tests) {
    require(join(testsDir, test));
}

console.log(`[tests] ${tests.length} test files passed`);

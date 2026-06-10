const { readdirSync } = require('fs');
const { join } = require('path');

const sourceTestsDir = __dirname;
const testsDir = join(__dirname, '..', 'temp', 'test-dist', 'tests');
const sourceTests = readdirSync(sourceTestsDir)
    .filter((file) => file.endsWith('.test.js'))
    .sort();
const tests = readdirSync(testsDir)
    .filter((file) => file.endsWith('.test.js'))
    .sort();

for (const test of sourceTests) {
    require(join(sourceTestsDir, test));
}

for (const test of tests) {
    require(join(testsDir, test));
}

console.log(`[tests] ${sourceTests.length + tests.length} test files passed`);

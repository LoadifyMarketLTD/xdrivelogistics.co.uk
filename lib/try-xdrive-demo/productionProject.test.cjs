const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, 'productionProject.ts'), 'utf8');
assert.match(source, /jqxlauexhkonixtjvljw/);
assert.match(source, /url\.protocol === 'https:'/);
assert.match(source, /url\.hostname ===/);
assert.match(source, /!url\.username && !url\.password/);
assert.match(source, /!url\.search && !url\.hash/);
console.log('PASS production URL boundary source assertions');

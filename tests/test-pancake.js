'use strict';

const test = require('tape');
const path = require('path');
const pancake = require('../lib/pancake');

test('table-without-metadata-name', function(t) {
  let count = 0;
  let srcPath = path.join(__dirname, 
    './fixtures/table-without-metadata-name');
  pancake.pack(srcPath).forEach((name, model) => {
    t.equal(name, 'Model.M1');
    t.equal(model.base, 'PersistedModel');
    count += 1;
  });
  t.equal(count, 1);
  t.end();
});

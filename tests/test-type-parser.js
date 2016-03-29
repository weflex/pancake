'use strict';

const test = require('tape');
const TypeParser = require('../lib/type-parser.js');

test('parsing native types', function(t) {
  t.equal(TypeParser.parse('string'), 'String');
  t.equal(TypeParser.parse('number'), 'Number');
  t.equal(TypeParser.parse('bool'), 'Boolean');
  t.equal(TypeParser.parse('object'), 'Object');
  t.equal(TypeParser.parse('Date'), 'Date');
  t.equal(TypeParser.parse('Array'), 'Array');
  t.end();
});

test('parsing meta types', function(t) {
  t.deepEqual(TypeParser.parse('hasMany(foobar)'), {
    status: true,
    value: {
      args: ['foobar'],
      name: 'hasMany',
    },
  });
  t.deepEqual(TypeParser.parse('Array(x,y)'), {
    status: true,
    value: {
      args: ['x', 'y'],
      name: 'Array',
    },
  });
  t.end();
});

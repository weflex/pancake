'use strict';

const test = require('tape');
const Utils = require('../lib/utils.js');

test('pluralize', function(t) {
  t.equal(Utils.pluralize('WeflexUser'), 'weflex-users');
  t.end();
});

test('pluralize2', function(t) {
  t.equal(Utils.pluralize2('users'), 'userIds');
  t.end();
});

test('getModelName', function(t) {
  t.equal(Utils.getModelName({name: 'WeflexUser', base: 'Model'}), 'weflex-users');
  t.equal(Utils.getModelName({name: 'WeflexUser', base: 'PersistedModel'}), 'weflex-users');
  t.equal(Utils.getModelName({name: 'WeflexUser', base: 'User'}), 'users');
  t.end();
});
